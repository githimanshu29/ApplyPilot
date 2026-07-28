import { useState, useRef } from "react";
import { useAuth, useUploadResume, useConfirmResume } from "../hooks/useAuth";
import api from "../lib/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Spinner from "../components/ui/Spinner";

// ── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-[#e6edf3]">{title}</h2>
      {sub && <p className="text-xs text-[#8b949e] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Upload Zone ─────────────────────────────────────────────────────────────
function UploadZone({ onFile, loading }) {
  const ref = useRef();
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") onFile(file);
  }

  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
        ${
          dragging
            ? "border-blue-500 bg-blue-500/5"
            : "border-[#30363d] hover:border-[#484f58] hover:bg-[#21262d]/50"
        }
      `}
    >
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
      />
      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-[#8b949e]">Parsing your resume with AI…</p>
          <p className="text-xs text-[#484f58]">
            This takes about 10-15 seconds
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="text-4xl">📄</div>
          <p className="text-sm font-medium text-[#e6edf3]">
            Drop your PDF here or click to browse
          </p>
          <p className="text-xs text-[#8b949e]">
            Max 5MB · Text-based PDF only · Not scanned
          </p>
        </div>
      )}
    </div>
  );
}

// ── Skills Editor ───────────────────────────────────────────────────────────
function SkillsEditor({ skills, onChange }) {
  const [input, setInput] = useState("");

  function add() {
    const val = input.trim();
    if (!val || skills.includes(val)) return;
    onChange([...skills, val]);
    setInput("");
  }

  function remove(skill) {
    onChange(skills.filter((s) => s !== skill));
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Add a skill and press Enter"
          className="flex-1 px-3 py-2 rounded-lg text-sm bg-[#0d1117] border border-[#30363d] text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-blue-500"
        />
        <Button onClick={add} variant="secondary" size="sm">
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#21262d] border border-[#30363d] text-[#e6edf3]"
          >
            {skill}
            <button
              onClick={() => remove(skill)}
              className="text-[#484f58] hover:text-red-400 transition-colors leading-none"
            >
              ✕
            </button>
          </span>
        ))}
        {skills.length === 0 && (
          <p className="text-xs text-[#484f58] py-1">No skills added yet</p>
        )}
      </div>
    </div>
  );
}

// ── Parsed Preview ──────────────────────────────────────────────────────────
function ParsedPreview({ preview, onEdit, onConfirm, saving }) {
  const [data, setData] = useState(preview);

  function updateSkills(skills) {
    setData((prev) => ({ ...prev, skills }));
  }

  return (
    <div className="space-y-4">
      {/* success banner */}
      <div className="flex items-start gap-3 px-4 py-3 border rounded-lg bg-green-500/10 border-green-500/20">
        <span className="text-green-400 text-lg mt-0.5">✓</span>
        <div>
          <p className="text-sm font-medium text-green-400">
            Resume parsed successfully
          </p>
          <p className="text-xs text-[#8b949e] mt-0.5">
            Review the extracted data below. Edit anything that looks wrong,
            then confirm to save.
          </p>
        </div>
      </div>

      {/* skills — most important to review */}
      <Card>
        <SectionHeader
          title="Skills extracted"
          sub={`${data.skills.length} skills found — add or remove as needed`}
        />
        <SkillsEditor skills={data.skills} onChange={updateSkills} />
      </Card>

      {/* experience */}
      {data.experience?.length > 0 && (
        <Card>
          <SectionHeader
            title="Experience"
            sub={`${data.experience.length} entries found`}
          />
          <div className="space-y-3">
            {data.experience.map((exp, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d]"
              >
                <p className="text-sm font-medium text-[#e6edf3]">{exp.role}</p>
                <p className="text-xs text-[#8b949e]">
                  {exp.company} · {exp.duration}
                </p>
                <ul className="mt-2 space-y-1">
                  {exp.bullets?.slice(0, 3).map((b, j) => (
                    <li key={j} className="text-xs text-[#8b949e] flex gap-2">
                      <span className="text-[#484f58] flex-shrink-0">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                  {exp.bullets?.length > 3 && (
                    <li className="text-xs text-[#484f58]">
                      +{exp.bullets.length - 3} more bullets
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* projects */}
      {data.projects?.length > 0 && (
        <Card>
          <SectionHeader
            title="Projects"
            sub={`${data.projects.length} projects found`}
          />
          <div className="space-y-2">
            {data.projects.map((p, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d]"
              >
                <p className="text-sm font-medium text-[#e6edf3]">{p.name}</p>
                {p.techStack?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.techStack.map((t) => (
                      <span
                        key={t}
                        className="text-xs px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* education */}
      {data.education?.college && (
        <Card>
          <SectionHeader title="Education" />
          <div className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d]">
            <p className="text-sm font-medium text-[#e6edf3]">
              {data.education.degree} in {data.education.branch}
            </p>
            <p className="text-xs text-[#8b949e] mt-0.5">
              {data.education.college}
            </p>
            <p className="text-xs text-[#8b949e]">
              {data.education.cgpa && `CGPA: ${data.education.cgpa}`}
              {data.education.year && ` · Class of ${data.education.year}`}
            </p>
          </div>
        </Card>
      )}

      {/* action buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => {
            console.log("✅ Confirm button clicked");
            onConfirm(data);
          }}
          loading={saving}
          size="lg"
        >
          Confirm & save profile
        </Button>
        <Button
          onClick={onEdit}
          variant="secondary"
          size="lg"
          disabled={saving}
        >
          Re-upload
        </Button>
      </div>
    </div>
  );
}

// ── Current Profile View ────────────────────────────────────────────────────
function CurrentProfile({ profile, onReupload }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-green-400">
          <span>✓</span>
          <span className="font-medium">Profile active</span>
          {profile.resumeMeta?.filename && (
            <span className="text-[#8b949e] text-xs">
              · {profile.resumeMeta.filename}
            </span>
          )}
        </div>
        <Button onClick={onReupload} variant="secondary" size="sm">
          Re-upload resume
        </Button>
      </div>

      <Card>
        <SectionHeader
          title="Your skills"
          sub={`${profile.skills?.length || 0} skills on file`}
        />
        <div className="flex flex-wrap gap-1.5">
          {profile.skills?.map((skill) => (
            <span
              key={skill}
              className="px-2.5 py-1 rounded-lg text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400"
            >
              {skill}
            </span>
          ))}
          {!profile.skills?.length && (
            <p className="text-xs text-[#484f58]">
              No skills — re-upload resume
            </p>
          )}
        </div>
      </Card>

      {profile.experience?.length > 0 && (
        <Card>
          <SectionHeader
            title="Experience"
            sub={`${profile.experience.length} entries`}
          />
          <div className="space-y-2">
            {profile.experience.map((exp, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[#e6edf3]">{exp.role}</span>
                <span className="text-xs text-[#8b949e]">{exp.company}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {profile.projects?.length > 0 && (
        <Card>
          <SectionHeader
            title="Projects"
            sub={`${profile.projects.length} projects`}
          />
          <div className="flex flex-wrap gap-2">
            {profile.projects.map((p, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-lg bg-[#21262d] border border-[#30363d] text-[#8b949e]"
              >
                {p.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      {profile.links && Object.values(profile.links).some(Boolean) && (
        <Card>
          <SectionHeader title="Links" />
          <div className="flex flex-wrap gap-3">
            {Object.entries(profile.links)
              .filter(([, v]) => v)
              .map(([key, value]) => (
                <a
                  key={key}
                  href={value.startsWith("http") ? value : `https://${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 capitalize transition-colors hover:text-blue-300"
                >
                  {key} →
                </a>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Main Profile Page --- Evry thing starts here
export default function ProfilePage() {
  const { user } = useAuth();
  const uploadResume = useUploadResume();
  const confirmResume = useConfirmResume();

  const [phase, setPhase] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");

  const hasProfile = !!(
    user?.profile?.resumeRaw || user?.profile?.skills?.length
  );

  async function handleFile(file) {
    setError("");
    setPhase("uploading");

    uploadResume.mutate(file, {
      onSuccess: (res) => {
        setPreview(res.data.preview);
        setMeta(res.data.meta);
        setPhase("preview");
      },
      onError: (err) => {
        setError(
          err.response?.data?.message || "Upload failed. Try a different PDF.",
        );
        setPhase("idle");
      },
    });
  }

async function handleConfirm(data) {
  console.log("1. handleConfirm entered");

  setPhase("saving");

  confirmResume.mutate(
    { ...data, meta },
    {
      onSuccess: () => {
        console.log("2. Mutation success");
        setPhase("done");
      },
      onError: (err) => {
        console.error("3. Mutation error", err);
        setError(err.response?.data?.message || "Save failed");
        setPhase("preview");
      },
    }
  );
}


  function handleReupload() {
    setPhase("idle");
    setPreview(null);
    setError("");
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* page header */}
      <div>
        <h1 className="text-xl font-semibold text-[#e6edf3]">Your Profile</h1>
        <p className="text-sm text-[#8b949e] mt-0.5">
          Upload your resume — AI extracts skills, experience, and projects
          automatically
        </p>
      </div>

      {/* error */}
      {error && (
        <div className="px-4 py-3 text-sm text-red-400 border rounded-lg bg-red-500/10 border-red-500/20">
          {error}
        </div>
      )}

      {/* phase: idle — show upload zone (or current profile if exists) */}
      {(phase === "idle" || phase === "uploading") && !hasProfile && (
        <Card>
          <SectionHeader
            title="Upload your resume"
            sub="AI will extract everything — review before saving"
          />
          <UploadZone onFile={handleFile} loading={phase === "uploading"} />
        </Card>
      )}

      {/* phase: idle — has profile — show current + re-upload option */}
      {(phase === "idle" || phase === "uploading") && hasProfile && (
        <>
          {phase === "uploading" ? (
            <Card>
              <UploadZone onFile={handleFile} loading />
            </Card>
          ) : (
            <CurrentProfile
              profile={user.profile}
              onReupload={() => setPhase("uploading")}
            />
          )}
        </>
      )}

      {/* phase: preview — show parsed data for review */}
      {phase === "preview" && preview && (
        <ParsedPreview
          preview={preview}
          onEdit={handleReupload}
          onConfirm={handleConfirm}
          saving={false}
        />
      )}

      {/* phase: saving */}
      {phase === "saving" && (
        <div className="flex items-center gap-3 text-sm text-[#8b949e]">
          <Spinner />
          Saving your profile…
        </div>
      )}

      {/* phase: done */}
      {phase === "done" && (
        <div className="px-4 py-3 text-sm font-medium text-green-400 border rounded-lg bg-green-500/10 border-green-500/20">
          ✓ Profile saved — you're ready to analyze job descriptions
        </div>
      )}

      {/* done state shows updated profile */}
      {phase === "done" && user?.profile && (
        <CurrentProfile profile={user.profile} onReupload={handleReupload} />
      )}
    </div>
  );
}
