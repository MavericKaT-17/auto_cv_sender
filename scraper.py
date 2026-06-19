import time
import re
import csv
import os
import random
import undetected_chromedriver as uc
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field
from typing import Optional

# Layer 2 Compliant Data Schema
class RawJobPayload(BaseModel):
    source_platform: str = "Indeed"
    internal_job_id: str
    company_name: str
    job_title: str
    location: str
    job_url: str
    salary: str = "not given"
    hr_email: str = "not given"
    job_description: str

def extract_deep_details_from_html(html_content: str, fallback_id: str) -> tuple[str, str, str]:
    soup = BeautifulSoup(html_content, "html.parser")
    
    # 1. Extract Full Job Description Text
    desc_container = soup.find(id="jobDescriptionText") or soup.find(class_=re.compile("jobsearch-JobComponent-description"))
    
    raw_description = desc_container.get_text(separator="\n", strip=True) if desc_container else "Extraction Failed"
    
    # ==========================================
    # APPLY PRE-PROCESSING PIPELINE HERE
    # ==========================================
    full_description = clean_job_text(raw_description)
    
    # 2. Extract Salary Information
    salary = "not given"
    salary_element = soup.find(id="salaryInfoAndJobType") or soup.find(class_=re.compile("salarySnippet")) or soup.find(attrs={"data-testid": "jobsearch-JobMetadataHeader-item"})
    if salary_element:
        # Also apply light cleaning to salary text to keep the row tidy
        salary = re.sub(r'\s+', ' ', salary_element.get_text(strip=True))
        
    # 3. Extract Hidden HR Email addresses using a Regex filter over the document body
    hr_email = "not given"
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    found_emails = re.findall(email_pattern, html_content)
    
    if found_emails:
        # Filter out common tracking domains, libraries, or system addresses that aren't real HR contacts
        filtered_emails = [e for e in found_emails if not any(domain in e.lower() for domain in ["indeed", "sentry", "w3.org", "git", "schema.org", "bootstrap"])]
        if filtered_emails:
            hr_email = filtered_emails[0] # Grab the first legitimate email address found
            
    return full_description, salary, hr_email

def scrape_indeed_hk_deep_pipeline(keyword: str, max_pages: int = 1):
    """Uses undetected-chromedriver to discover jobs and automatically dig into their descriptions."""
    final_payloads = []
    discovered_skeletons = []
    
    print(f"[!] Initializing undetected-chromedriver stealth context...")
    options = uc.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-popup-blocking")
    
    try:
        # Initializing driver with your working configuration
        driver = uc.Chrome(options=options, headless=False, version_main=149)
        
        # ==========================================
        # STEP 1: SCAN THE JOB LISTINGS FOR LINKS
        # ==========================================
        for page_num in range(max_pages):
            offset = page_num * 10
            search_url = f"https://hk.indeed.com/jobs?q={keyword}&l=Hong+Kong&start={offset}"
            print(f"[!] Scanning search page index: {search_url}")
            
            driver.get(search_url)
            time.sleep(random.uniform(3.0, 5.0)) # Human-like pacing delay
            
            soup = BeautifulSoup(driver.page_source, "html.parser")
            job_cards = soup.find_all("div", class_=re.compile("job_seen_beacon"))
            
            for card in job_cards:
                try:
                    title_element = card.find("h2", class_=re.compile("jobCard Bronx-model-title")) or card.find("a", class_=re.compile("jcs-JobTitle"))
                    if not title_element: continue
                    
                    link_tag = title_element if title_element.name == "a" else title_element.find("a")
                    jk_id = link_tag.get("data-jk") if link_tag else None
                    if not jk_id: continue
                    
                    job_title = title_element.get_text(strip=True)
                    company_element = card.find(attrs={"data-testid": "company-name"})
                    company_name = company_element.get_text(strip=True) if company_element else "Unknown"
                    location_element = card.find(attrs={"data-testid": "text-location"})
                    location = location_element.get_text(strip=True) if location_element else "Hong Kong"
                    job_url = f"https://hk.indeed.com/viewjob?jk={jk_id}"
                    
                    discovered_skeletons.append({
                        "internal_job_id": jk_id,
                        "company_name": company_name,
                        "job_title": job_title,
                        "location": location,
                        "job_url": job_url
                    })
                except Exception:
                    continue

        print(f"\n[✓] Discovered {len(discovered_skeletons)} job leads. Starting deep extraction phase...\n")
        
        # ==========================================
        # STEP 2: NAVIGATE TO EACH URL FOR DETAILS (HARDENED)
        # ==========================================
        for idx, job in enumerate(discovered_skeletons, start=1):
            print(f"[{idx}/{len(discovered_skeletons)}] Deep parsing: {job['job_title']} @ {job['company_name']}")
            
            # Defensive check: Verify browser window context is still alive
            try:
                # Ping the current window handles to ensure web view exists
                _ = driver.window_handles 
            except Exception:
                print("[!] Web view lost! Spawning a clean, resilient recovery browser session...")
                try: driver.quit()
                except: pass
                # Re-initialize a fresh stealth window session
                driver = uc.Chrome(options=options, headless=False, version_main=149)
            
            try:
                driver.get(job["job_url"])
                
                # Introduce variable gaussian jitter pacing
                # Hardcoded fixed delays look highly mechanical to security telemetry
                time.sleep(random.uniform(6.0, 10.0)) 
                
                # Double-check page source state didn't trigger window destruction
                html_source = driver.page_source
                if "checking your browser" in html_source.lower() or "captcha" in html_source.lower():
                    print("[X] Caught by security wall during deep parse. Pausing execution...")
                    input("[?] Solve the challenge in the window, then press Enter to resume...")
                    html_source = driver.page_source

                desc, salary, hr_email = extract_deep_details_from_html(html_source, job["internal_job_id"])
                
                validated_job = RawJobPayload(
                    internal_job_id=job["internal_job_id"],
                    company_name=job["company_name"],
                    job_title=job["job_title"],
                    location=job["location"],
                    job_url=job["job_url"],
                    salary=salary,
                    hr_email=hr_email,
                    job_description=desc
                )
                final_payloads.append(validated_job)
                
            except Exception as item_err:
                print(f"   [X] Skipping current target entry due to state failure: {item_err}")
                continue
                
        try:
            driver.quit()
        except:
            pass
        driver.quit()
        print("\n[!] Scraping session closed down successfully.")
        
    except Exception as e:
        print(f"[X] Critical loop error inside core framework: {e}")
        
    return final_payloads


def clean_job_text(raw_text: str) -> str:
    """
    Executes structural cleaning over raw extracted HTML text blocks.
    Preserves clean paragraph spacing while discarding carriage returns and layout noise.
    """
    if not raw_text or raw_text == "Extraction Failed":
        return "Extraction Failed"
        
    # 1. Replace literal '\n', '\t', or '\\n' text strings with real spaces/newlines
    cleaned = raw_text.replace('\\n', '\n').replace('\\t', ' ')
    
    # 2. Convert common HTML space entities like non-breaking spaces (\xa0) into normal spaces
    cleaned = re.sub(r'[\xa0\u200b\t]', ' ', cleaned)
    
    # 3. Collapse multiple horizontal spaces down into a single space
    cleaned = re.sub(r'[ ]+', ' ', cleaned)
    
    # 4. Standardize sentence spacing and clean up vertical stacked line spacing
    # This prevents sentences from combining into one giant block while stripping excessive spacing.
    lines = [line.strip() for line in cleaned.split('\n')]
    
    # Reconstruct the body text, allowing only up to one blank row separating structural text blocks
    cleaned_paragraphs = []
    for line in lines:
        if line:
            cleaned_paragraphs.append(line)
        elif cleaned_paragraphs and cleaned_paragraphs[-1] != "":
            # Insert a clean single paragraph gap placeholder
            cleaned_paragraphs.append("") 
            
    # Remove any trailing empty entries at the very end of the array sequence
    if cleaned_paragraphs and cleaned_paragraphs[-1] == "":
        cleaned_paragraphs.pop()
        
    return "\n".join(cleaned_paragraphs)

# ==========================================
# FILE WRITER EXECUTOR
# ==========================================
if __name__ == "__main__":
    search_keyword = "Software Engineer"
    csv_filename = "scraped_jobs.csv"
    
    # Fire up the live extraction loop
    results = scrape_indeed_hk_deep_pipeline(keyword=search_keyword, max_pages=1)
    
    if results:
        fieldnames = list(results[0].model_dump().keys())
        file_exists = os.path.isfile(csv_filename)
        
        try:
            with open(csv_filename, mode='a', newline='', encoding='utf-8') as file:
                writer = csv.DictWriter(file, fieldnames=fieldnames)
                if not file_exists:
                    writer.writeheader()
                
                for job in results:
                    writer.writerow(job.model_dump())
                    print(f" -> Saved Row: {job.job_title} | Salary: {job.salary} | Email: {job.hr_email}")
                    
            print(f"\n[✓] Data pipelines successfully mapped and appended into: {csv_filename}")
        except Exception as e:
            print(f"[X] Output spreadsheet IO failure: {e}")
    else:
        print("\n[!] Execution completed. No new profiles appended.")