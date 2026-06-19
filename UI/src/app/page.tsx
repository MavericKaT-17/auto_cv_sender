"use client";

import { useEffect, useState } from 'react';

type Job = {
  internal_job_id: string;
  source_platform: string;
  company_name: string;
  job_title: string;
  location: string;
  job_url: string;
  salary: string;
  hr_email: string;
  cv_template_used: string | null;
  status: string;
  scraped_at: string | null;
  applied_at: string | null;
};

type Profile = {
  category: string;
  label: string;
  filename: string;
  exists: boolean;
  bytes: number;
  updatedAt: string | null;
};

type Metrics = {
  total?: number;
  pending?: number;
  matched?: number;
  applied?: number;
};

const statusOptions = ['ALL', 'PENDING', 'MATCHED', 'APPLIED', 'REJECTED'];
const categoryOptions = [
  { value: 'tech', label: 'Software Development' },
  { value: 'robotics', label: 'Robotics & AI' },
  { value: 'education', label: 'Academic / Education' },
];

function formatDate(value: string | null) {
  if (!value) {
    return 'not given';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!value) {
    return '0 KB';
  }

  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('tech');
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const loadDashboard = async () => {
    setIsLoading(true);

    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    if (search.trim()) params.set('search', search.trim());

    const [jobsRes, profilesRes] = await Promise.all([
      fetch(`/api/jobs?${params.toString()}`, { cache: 'no-store' }),
      fetch('/api/profiles', { cache: 'no-store' }),
    ]);

    const jobsData = await jobsRes.json();
    const profilesData = await profilesRes.json();

    if (!jobsRes.ok) {
      throw new Error(jobsData.error || 'Failed to load jobs');
    }

    if (!profilesRes.ok) {
      throw new Error(profilesData.error || 'Failed to load profiles');
    }

    setJobs(jobsData.jobs || []);
    setMetrics(jobsData.metrics || {});
    setProfiles(profilesData.profiles || []);
    setIsLoading(false);
  };

  useEffect(() => {
    loadDashboard().catch((err) => {
      setUploadStatus({ type: 'error', text: err.message });
      setIsLoading(false);
    });
  }, [search, status]);

  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (data.success) {
      setUploadStatus({ type: 'success', text: data.message });
      setFile(null);
      await loadDashboard();
    } else {
      setUploadStatus({ type: 'error', text: data.error });
    }

    setIsUploading(false);
  };

  return (
    <main className="shell">
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Layer 2 Control Hub</p>
            <h1>Auto-CV Knowledge Base</h1>
            <p className="subtle">SQLite application tracker and Markdown master-CV storage.</p>
          </div>
          <div className="status-strip" aria-label="Application metrics">
            <div className="metric">
              <span>Tracked</span>
              <strong>{metrics.total || 0}</strong>
            </div>
            <div className="metric">
              <span>Pending</span>
              <strong>{metrics.pending || 0}</strong>
            </div>
            <div className="metric">
              <span>Applied</span>
              <strong>{metrics.applied || 0}</strong>
            </div>
          </div>
        </header>

        <aside className="side-stack">
          <section className="panel">
            <div className="panel-inner">
              <h2>Master CV Assets</h2>
              <form className="upload-form" onSubmit={handleUploadSubmit}>
                <div className="field">
                  <label htmlFor="category">Track</label>
                  <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="cv-file">Markdown file</label>
                  <input
                    id="cv-file"
                    type="file"
                    accept=".md,text/markdown,text/plain"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files ? e.target.files[0] : null)}
                  />
                </div>

                <button className="primary-button" type="submit" disabled={!file || isUploading}>
                  {isUploading ? 'Uploading...' : 'Upload Template'}
                </button>
              </form>
              {uploadStatus && <p className={`alert ${uploadStatus.type}`}>{uploadStatus.text}</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-inner">
              <h2>Profile Tracks</h2>
              <div className="profile-list">
                {profiles.map((profile) => (
                  <article className="profile-card" key={profile.category}>
                    <header>
                      <h3>{profile.label}</h3>
                      <span className={`badge ${profile.exists ? '' : 'missing'}`}>
                        {profile.exists ? 'Ready' : 'Missing'}
                      </span>
                    </header>
                    <p>{profile.filename}</p>
                    <p>
                      {profile.exists
                        ? `${formatBytes(profile.bytes)} · ${formatDate(profile.updatedAt)}`
                        : 'Awaiting Markdown source'}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </aside>

        <section className="main-stack">
          <div className="panel">
            <div className="panel-inner">
              <div className="table-header">
                <div>
                  <h2>Live Vacancy Queue</h2>
                  <p className="subtle">{isLoading ? 'Loading local queue...' : `${jobs.length} visible application records`}</p>
                </div>
                <button className="ghost-button" type="button" onClick={() => loadDashboard()}>
                  Refresh
                </button>
              </div>

              <div className="filters">
                <input
                  className="search"
                  type="search"
                  placeholder="Search company, role, location, contact"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatus('ALL');
                  }}
                >
                  Clear
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Position</th>
                      <th>Compensation</th>
                      <th>HR Contact</th>
                      <th>Status</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.length === 0 ? (
                      <tr>
                        <td className="empty-state" colSpan={6}>
                          No application records in the local queue.
                        </td>
                      </tr>
                    ) : (
                      jobs.map((job) => (
                        <tr key={job.internal_job_id}>
                          <td className="company-cell">
                            <strong>{job.company_name}</strong>
                            <span>{job.location || 'not given'}</span>
                          </td>
                          <td className="role-cell">
                            <strong>{job.job_title}</strong>
                            <span>{job.internal_job_id}</span>
                          </td>
                          <td>{job.salary || 'not given'}</td>
                          <td>{job.hr_email || 'not given'}</td>
                          <td>
                            <span className={`badge ${job.status === 'PENDING' ? 'pending' : ''}`}>
                              {job.status}
                            </span>
                          </td>
                          <td>
                            <a className="job-link" href={job.job_url} target="_blank" rel="noreferrer">
                              {job.source_platform || 'Source'}
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
