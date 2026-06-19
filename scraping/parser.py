import csv

input_file = 'scraped_jobs.csv'
output_file = 'jobs_single_line.csv'

fields = ["source", "job_id", "company", "title", "location", "url", "salary", "email", "description"]

with open(input_file, mode='r', encoding='utf-8') as infile, \
     open(output_file, mode='w', encoding='utf-8', newline='') as outfile:
    
    reader = csv.DictReader(infile, fieldnames=fields)
    writer = csv.DictWriter(outfile, fieldnames=fields)
    
    for row in reader:
        # Replace actual line breaks with space or literal '\n' text
        if row['description']:
            row['description'] = row['description'].replace('\r\n', ' ').replace('\n', ' ')
        
        writer.writerow(row)

print(f"Done! Cleaned data saved to {output_file}")
