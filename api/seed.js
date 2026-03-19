import { supabaseRequest } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.query.key !== 'bamu2024seed') {
    return res.status(403).json({ error: 'Invalid key' });
  }

  const departments = [
    { name:'Computer Science',        code:'CS',   years:4 },
    { name:'Electronics Engineering', code:'EC',   years:4 },
    { name:'Mechanical Engineering',  code:'ME',   years:4 },
    { name:'Civil Engineering',       code:'CE',   years:4 },
    { name:'MBA',                     code:'MBA',  years:2 },
    { name:'BBA',                     code:'BBA',  years:3 },
    { name:'Law',                     code:'LAW',  years:5 },
    { name:'MBBS',                    code:'MBBS', years:5 },
    { name:'Architecture',            code:'ARCH', years:5 },
    { name:'Data Science',            code:'DS',   years:4 },
    { name:'Chemistry',               code:'CHEM', years:3 },
    { name:'Commerce',                code:'COM',  years:3 },
    { name:'Arts',                    code:'ARTS', years:3 },
    { name:'Physics',                 code:'PHY',  years:3 },
    { name:'Agriculture',             code:'AGR',  years:4 },
  ];

  const firstNames = [
    'Ganesh','Priya','Rahul','Sneha','Amit','Kavita',
    'Suresh','Pooja','Akash','Sunita','Vijay','Anjali',
    'Rajesh','Meera','Ravi','Nisha','Sanjay','Rekha',
    'Deepak','Seema','Mahesh','Lata','Anil','Varsha',
    'Nilesh','Padma','Santosh','Shubhangi','Abhijit',
    'Manisha','Pravin','Archana','Sachin','Jyoti',
    'Dilip','Smita','Vikas','Savita','Nikhil','Pallavi',
    'Yogesh','Shweta','Rohit','Geeta','Tushar','Madhuri',
    'Aniket','Rupali','Kiran','Ashwini',
  ];

  const lastNames = [
    'Shinde','Patil','Jadhav','Deshmukh','Kulkarni',
    'More','Kadam','Pawar','Gaikwad','Lokhande',
    'Dhage','Munde','Bhosale','Sawant','Kale',
    'Waghmare','Shirke','Deshpande','Bansode','Thakre',
    'Kamble','Salve','Thorat','Chavan','Dhole',
    'Ingle','Kharat','Gavhane','Wagh','Zope',
    'Shirsat','Nair',
  ];

  const addresses = [
    'Cidco Colony, Chhatrapati Sambhajinagar, MH 431001',
    'Garkheda Parisar, Aurangabad, MH 431009',
    'Hudco, Chhatrapati Sambhajinagar, MH 431001',
    'N-6 Cidco, Aurangabad, MH 431003',
    'Jalna Road, Aurangabad, MH 431001',
    'Beed Bypass Road, Aurangabad, MH 431005',
    'Station Road, Jalna, MH 431203',
    'Camp Area, Beed, MH 431122',
    'Osmanabad Road, Dharashiv, MH 413501',
    'Paithan Road, Aurangabad, MH 431001',
    'Kranti Chowk, Aurangabad, MH 431001',
    'TV Centre Road, Aurangabad, MH 431001',
    'Mukundwadi, Aurangabad, MH 431210',
    'Bajaj Nagar, Aurangabad, MH 431001',
    'Padegaon, Aurangabad, MH 431105',
  ];

  const bloodGroups = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
  const statuses = [
    'active','active','active','active','active',
    'active','active','active','active','active',
    'graduated','graduated','graduated','graduated',
    'graduated','graduated','graduated',
    'dropped','dropped','dropped',
    'transferred','transferred','suspended',
  ];
  const genders = ['Male','Male','Male','Female','Female','Female','Female'];

  const students = [];
  const usedIds = new Set();

  for (let i = 0; i < 100; i++) {
    const dept       = departments[i % departments.length];
    const firstName  = firstNames[i % firstNames.length];
    const lastName   = lastNames[i % lastNames.length];
    const status     = statuses[i % statuses.length];
    const gender     = genders[i % genders.length];
    const bloodGroup = bloodGroups[i % bloodGroups.length];
    const admYear    = 2018 + (i % 7);
    const gradYear   = admYear + dept.years;
    const curYear    = Math.min(dept.years, 2025 - admYear + 1);
    const curSem     = Math.min(dept.years * 2, curYear * 2);

    // Generate unique student ID
    let sid, attempt = 0;
    do {
      const num = String(((i + 1 + attempt) * 97) % 900 + 100);
      sid = `${dept.code}${admYear}${num}`;
      attempt++;
    } while (usedIds.has(sid));
    usedIds.add(sid);

    const phone = `+91-9${String(700000000 + (i * 1234567) % 99999999).padStart(9,'0')}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@bamu.ac.in`;
    const dobYear  = 2025 - 18 - (i % 8);
    const dobMonth = String((i % 12) + 1).padStart(2,'0');
    const dobDay   = String((i % 28) + 1).padStart(2,'0');
    const guardianFirst = firstNames[(i + 10) % firstNames.length];
    const guardianLast  = lastNames[(i + 5)  % lastNames.length];
    const actualGrad = status === 'graduated' ? gradYear
      : status === 'dropped' ? admYear + Math.floor(dept.years / 2)
      : null;

    students.push({
      full_name:         `${firstName} ${lastName}`,
      student_id:        sid,
      email:             email,
      phone_number:      phone,
      department_name:   dept.name,
      admission_year:    admYear,
      graduation_year:   actualGrad,
      current_year:      ['graduated','dropped'].includes(status) ? dept.years : curYear,
      current_semester:  status === 'graduated' ? dept.years * 2 : curSem,
      enrollment_status: status,
      gender:            gender,
      blood_group:       bloodGroup,
      date_of_birth:     `${dobYear}-${dobMonth}-${dobDay}`,
      address:           addresses[i % addresses.length],
      account_number:    `ACC${String(10000000 + i * 12345).slice(0, 8)}`,
      guardian_name:     `${guardianFirst} ${guardianLast}`,
      guardian_phone:    `+91-8${String(800000000 + (i * 987654) % 99999999).padStart(9,'0')}`,
    });
  }

  // Insert students in batches of 20
  let inserted = 0;
  const errors = [];
  for (let b = 0; b < students.length; b += 20) {
    const batch = students.slice(b, b + 20);
    const r = await supabaseRequest(
      'POST',
      '/rest/v1/students?on_conflict=student_id',
      batch, true,
      { Prefer: 'resolution=merge-duplicates,return=minimal' }
    );
    if (r.status >= 200 && r.status < 300) {
      inserted += batch.length;
    } else {
      errors.push(`Batch ${Math.floor(b/20)+1}: ${JSON.stringify(r.data)}`);
    }
  }

  // Insert semesters for each student
  let semInserted = 0;
  for (const stu of students) {
    const stuRes = await supabaseRequest('GET',
      `/rest/v1/students?student_id=eq.${stu.student_id}&select=id`,
      null, false
    );
    if (!stuRes.data?.[0]?.id) continue;
    const stuId = stuRes.data[0].id;
    const numSems = stu.enrollment_status === 'graduated'
      ? (stu.current_semester || 8)
      : Math.max(1, stu.current_semester || 2);

    const sems = [];
    let runCgpa = 0;
    for (let s = 1; s <= numSems; s++) {
      const sgpa = parseFloat((5.5 + Math.random() * 4.3).toFixed(2));
      runCgpa = parseFloat(((runCgpa * (s-1) + sgpa) / s).toFixed(2));
      const ay = stu.admission_year + Math.floor((s-1)/2);
      const result = sgpa >= 5.0 ? 'pass'
        : Math.random() > 0.5 ? 'fail' : 'backlog';
      sems.push({
        student_id:      stuId,
        semester_number: s,
        academic_year:   `${ay}-${String(ay+1).slice(2)}`,
        sgpa:            sgpa,
        cgpa:            runCgpa,
        total_credits:   24 + (s % 4),
        earned_credits:  sgpa >= 5 ? 24 + (s % 4) : 20 + (s % 4),
        attendance_pct:  parseFloat((65 + Math.random() * 33).toFixed(1)),
        result:          result,
        backlogs:        result === 'pass' ? 0 : Math.floor(Math.random() * 3) + 1,
      });
    }
    if (sems.length) {
      const sr = await supabaseRequest(
        'POST',
        '/rest/v1/semesters?on_conflict=student_id,semester_number',
        sems, true,
        { Prefer: 'resolution=merge-duplicates,return=minimal' }
      );
      if (sr.status >= 200 && sr.status < 300)
        semInserted += sems.length;
    }
  }

  return res.status(200).json({
    success: true,
    students_inserted: inserted,
    semesters_inserted: semInserted,
    errors,
    message: `Seeded ${inserted} students + ${semInserted} semester records`,
  });
}
