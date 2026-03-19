# Deploying UniSearch

Follow these steps to deploy UniSearch on Vercel with Supabase.

## Step 1: Supabase Setup
1. Create a new project in Supabase.
2. Open the SQL Editor.
3. Run the schema below.
4. Copy your project URL, anon key, and service role key from `Settings -> API`.

## Step 2: Environment Variables
Add these values locally or in Vercel:

```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=your_admin_password
JWT_SECRET=any_32_character_random_string
```

## Step 3: Deploy to Vercel
1. Import the repository into Vercel.
2. Use the `Other` framework preset.
3. Keep the root directory as `./`.
4. Add the environment variables above.
5. Deploy. Vercel will serve the files in `api/` as serverless functions and `public/` as static assets.

## Step 4: Optional Seed
After deployment, you can seed sample student data by visiting:

`/api/seed?key=bamu2024seed`

Only use that route in controlled environments.

## Supabase Schema

```sql
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  code        VARCHAR(20) NOT NULL UNIQUE,
  total_years SMALLINT NOT NULL DEFAULT 4,
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO departments (name, code, total_years) VALUES
  ('Computer Science', 'CS', 4),
  ('Electronics Engineering', 'EC', 4),
  ('Mechanical Engineering', 'ME', 4),
  ('Civil Engineering', 'CE', 4),
  ('MBA', 'MBA', 2),
  ('BBA', 'BBA', 3),
  ('Law', 'LAW', 5),
  ('MBBS', 'MBBS', 5),
  ('Architecture', 'ARCH', 5),
  ('Data Science', 'DS', 4),
  ('Chemistry', 'CHEM', 3),
  ('Commerce', 'COM', 3),
  ('Arts', 'ARTS', 3),
  ('Physics', 'PHY', 3),
  ('Agriculture', 'AGR', 4)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT NOT NULL,
  student_id        TEXT NOT NULL UNIQUE,
  email             TEXT,
  phone_number      TEXT,
  address           TEXT,
  account_number    TEXT,
  department_id     INT REFERENCES departments(id),
  department_name   TEXT,
  admission_year    SMALLINT NOT NULL,
  graduation_year   SMALLINT,
  current_year      SMALLINT,
  current_semester  SMALLINT,
  enrollment_status TEXT DEFAULT 'active' CHECK (enrollment_status IN ('active', 'graduated', 'dropped', 'suspended', 'transferred')),
  date_of_birth     DATE,
  gender            TEXT CHECK (gender IN ('Male','Female','Other')),
  blood_group       TEXT,
  guardian_name     TEXT,
  guardian_phone    TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS semesters (
  id              SERIAL PRIMARY KEY,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  semester_number SMALLINT NOT NULL CHECK (semester_number BETWEEN 1 AND 12),
  academic_year   TEXT NOT NULL,
  sgpa            NUMERIC(4,2),
  cgpa            NUMERIC(4,2),
  total_credits   SMALLINT,
  earned_credits  SMALLINT,
  attendance_pct  NUMERIC(5,2),
  result          TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'pass', 'fail', 'detained', 'promoted', 'backlog')),
  backlogs        SMALLINT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, semester_number)
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read students" ON students FOR SELECT USING (true);
CREATE POLICY "Public read semesters" ON semesters FOR SELECT USING (true);
CREATE POLICY "Public read departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Service bypass students" ON students USING (true) WITH CHECK (true);
CREATE POLICY "Service bypass semesters" ON semesters USING (true) WITH CHECK (true);
CREATE POLICY "Service bypass departments" ON departments USING (true) WITH CHECK (true);
```
