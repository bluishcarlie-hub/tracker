const SUPABASE_URL = "https://oliggyodywpajiwzsoft.supabase.co";
const SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9saWdneW9keXdwYWppd3pzb2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjY1ODEsImV4cCI6MjA5MTMwMjU4MX0.tE5s7Q-NWd8Cz4jlOIOdr6Z68v8n8HNp9jHnur1VPLk";

let supabaseClient;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_API_KEY);
} else {
  console.error("Supabase library not loaded. Check CDN connection.");
}

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

async function initializeAdmin(){
  const { data, error } = await supabaseClient.from('users').select('id').eq('student_number', 'ad-minss').maybeSingle();
  if(error){
    console.warn('Admin initialization failed:', error.message);
    return;
  }
  if(!data){
    const { error: insertError } = await supabaseClient.from('users').insert([{ 
      student_number: 'ad-minss',
      name: 'Admin',
      email: 'admin@ojt.com',
      password: 'admin',
      role: 'admin',
      picture: null,
      approved: true,
      registration_date: new Date().toISOString().split('T')[0],
      location: 'Admin Office',
      last_active: null,
      is_active: false
    }]);
    if(insertError) console.warn('Failed to seed admin user:', insertError.message);
  }
}

initializeAdmin().catch(err => {
  console.warn('Error initializing admin during page load:', err);
});

function saveCurrentUser(){
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

function clearCurrentUser(){
  localStorage.removeItem('currentUser');
  currentUser = null;
}

function handleError(error){
  if(error){
    console.error(error);
    alert(error.message || 'Something went wrong.');
    return true;
  }
  return false;
}

function readFileAsDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadToStorage(file, path){
  const { data, error } = await supabaseClient.storage.from('ojt-images').upload(path, file, { upsert: true });
  if(error) throw error;
  const { data: urlData, error: urlError } = supabaseClient.storage.from('ojt-images').getPublicUrl(path);
  if(urlError) throw urlError;
  return urlData.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/ojt-images/${encodeURIComponent(path)}`;
}

async function getAllUsers(){
  const { data, error } = await supabaseClient.from('users').select('*').order('name', { ascending: true });
  if(handleError(error)) return [];
  return data || [];
}

async function getUserByEmail(email){
  const { data, error } = await supabaseClient.from('users').select('*').eq('email', email).maybeSingle();
  if(handleError(error)) return null;
  return data;
}

async function getUserByStudentNumber(studentNumber){
  const { data, error } = await supabaseClient.from('users').select('*').eq('student_number', studentNumber).maybeSingle();
  if(handleError(error)) return null;
  return data;
}

async function refreshCurrentUser(){
  if(!currentUser) return;
  const { data, error } = await supabaseClient.from('users').select('*').eq('id', currentUser.id).maybeSingle();
  if(handleError(error)) return;
  if(data){
    currentUser = data;
    saveCurrentUser();
  } else {
    clearCurrentUser();
  }
}

async function register(){
  if(!supabaseClient) return alert('Database connection failed. Please refresh the page.');
  
  let studentNumber = document.getElementById('studentNumber').value.trim();
  let name = document.getElementById('name').value.trim();
  let email = document.getElementById('email').value.trim();
  let password = document.getElementById('password').value.trim();
  let location = document.getElementById('location').value;
  let file = document.getElementById('picture').files[0];

  if(!studentNumber || !name || !email || !password || !location) return alert('Please fill all fields');
  if(!/^(\d{2}-\d{5}|ad-minss)$/.test(studentNumber)) return alert('Student number must be in format XX-XXXXX (or ad-minss for admin)');

  const { data: existingUser, error: existingError } = await supabaseClient.from('users').select('id').eq('student_number', studentNumber).maybeSingle();
  if(handleError(existingError)) return;
  if(existingUser) return alert('Student number already exists');

  const role = studentNumber === 'ad-minss' ? 'admin' : 'student';
  const approved = role === 'admin';

  let picture = null;
  if(file){
    try {
      const path = `profiles/${studentNumber}_${Date.now()}.jpg`;
      picture = await uploadToStorage(file, path);
    } catch(err){
      return alert('Failed to upload image.');
    }
  }

  const { error } = await supabaseClient.from('users').insert([{
    student_number: studentNumber,
    name,
    email,
    password,
    role,
    picture,
    approved,
    registration_date: new Date().toISOString().split('T')[0],
    location,
    last_active: null,
    is_active: false
  }]);
  if(handleError(error)) return;

  alert('Registered successfully! Waiting for admin approval.');
  window.location.href = 'login.html';
}

async function login(){
  if(!supabaseClient) return alert('Database connection failed. Please refresh the page.');
  
  let studentNumber = document.getElementById('studentNumber').value.trim();
  let password = document.getElementById('password').value.trim();

  const { data: user, error } = await supabaseClient.from('users').select('*').eq('student_number', studentNumber).eq('password', password).maybeSingle();
  if(handleError(error)) return;
  if(!user) return alert('Invalid login');
  if(user.role === 'student' && !user.approved) return alert('Your account is pending admin approval');

  currentUser = user;
  saveCurrentUser();
  await supabaseClient.from('users').update({ is_active: true, last_active: new Date().toISOString() }).eq('id', user.id);

  if(user.role === 'admin') window.location.href = 'admindashboard.html';
  else window.location.href = 'studentdashboard.html';
}

async function logout(){
  if(currentUser){
    await supabaseClient.from('users').update({ is_active: false }).eq('id', currentUser.id);
  }
  clearCurrentUser();
  window.location.href = 'login.html';
}

function showDashboard(){
  if(!currentUser) {
    console.error('showDashboard called without currentUser');
    return;
  }

  // Ensure we have a display name
  let displayName = currentUser.name;
  if(!displayName && currentUser.student_number) {
    displayName = currentUser.student_number;
  }
  if(!displayName) {
    displayName = currentUser.role === 'admin' ? 'ADMIN' : 'STUDENT';
  }

  let displayText = displayName;
  if(currentUser.student_number && currentUser.student_number !== displayName) {
    displayText += ` (${currentUser.student_number})`;
  }

  // Update the main role display (for admin dashboard compatibility)
  const roleElement = document.getElementById('role');
  if(roleElement) {
    roleElement.innerText = displayText;
  }

  // Update student profile section (for student dashboard)
  const studentNameElement = document.getElementById('studentName');
  const studentDetailsElement = document.getElementById('studentDetails');
  const studentProfileElement = document.getElementById('studentProfile');

  if(studentNameElement && studentDetailsElement && studentProfileElement) {
    // This is the student dashboard - show profile section
    studentNameElement.innerText = displayName;
    let details = [];
    if(currentUser.student_number) details.push(`ID: ${currentUser.student_number}`);
    if(currentUser.email) details.push(`Email: ${currentUser.email}`);
    if(currentUser.location) details.push(`Location: ${currentUser.location}`);
    if(currentUser.registration_date) {
      const regDate = new Date(currentUser.registration_date).toLocaleDateString();
      details.push(`Registered: ${regDate}`);
    }
    studentDetailsElement.innerText = details.join(' • ');
    studentProfileElement.style.display = 'flex';
  } else if(studentProfileElement) {
    // This is admin dashboard - hide profile section
    studentProfileElement.style.display = 'none';
  }

  let picElement = document.getElementById('profilePic');
  if(picElement){
    if(currentUser.picture){
      picElement.src = currentUser.picture;
      picElement.style.display = 'inline-block';
    } else if(currentUser.role === 'student') {
      // Show default avatar only for students
      picElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMzAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTMwIDMwQzM0LjQyMTMgMzAgMzggMjUuNDIxMyAzOCAyMEMzOCAxNS41NzkgMzQuNDIxMyAxMiAzMCAxMkMyNS41NzkgMTIgMjIgMTUuNTc5IDIyIDIwQzIyIDI1LjQyMTMgMjUuNTc5IDMwIDMwIDMwWiIgc3Ryb2tlPSIjOWNhM2FmIiBzdHJva2Utd2lkdGg9IjIiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPgo8L3N2Zz4=';
      picElement.style.display = 'inline-block';
    } else {
      // Hide for admins without pictures
      picElement.style.display = 'none';
    }
  }
}

async function addLog(){
  if(!supabaseClient) return alert('Database connection failed. Please refresh the page.');
  if(!currentUser) return alert('You must be logged in to add a log.');
  
  let date = document.getElementById('date').value;
  let task = document.getElementById('task').value.trim();
  let hours = document.getElementById('hours').value.trim();
  let file = document.getElementById('image').files[0];

  if(!date || !task || !hours) return alert('Please fill all fields');

  let proof = null;
  if(file){
    try {
      const path = `logs/${currentUser.student_number}_${Date.now()}.jpg`;
      proof = await uploadToStorage(file, path);
    } catch(err){
      return alert('Unable to upload proof image.');
    }
  }

  const status = proof ? 'Approved' : 'Pending';
  const { error } = await supabaseClient.from('logs').insert([{
    user_id: currentUser.id,
    email: currentUser.email,
    date,
    task,
    hours: Number(hours),
    proof,
    status
  }]);
  if(handleError(error)) return;

  await renderLogs();
}

async function renderLogs(){
  if(!supabaseClient) {
    console.error('Database connection failed');
    return;
  }

  if(!currentUser) {
    console.error('No current user for renderLogs');
    return;
  }

  let table = document.getElementById('logs');
  if(!table) {
    console.error('Logs table element not found');
    return;
  }

  table.innerHTML = '';
  let total = 0;
  let isAdmin = window.location.pathname.includes('admindashboard.html');

  try {
    let query = supabaseClient.from('logs').select('*').order('date', { ascending: false });
    if(!isAdmin){
      query = query.eq('user_id', currentUser.id);
    }
    const { data: logsData, error } = await query;
    if(handleError(error)) return;

    const usersList = await getAllUsers();

    (logsData || []).forEach((l) => {
      if(!isAdmin && l.status === 'Approved') total += Number(l.hours);

      let studentName = l.email;
      let user = null;
      if(isAdmin){
        user = usersList.find(u => u.id === l.user_id);
        studentName = user ? `${user.name || l.email}${user.student_number ? ` (${user.student_number})` : ''}` : l.email;
      }

      let row = '<tr>';
      if(isAdmin) row += `<td>${user && user.picture ? `<img src="${user.picture}" style="width:30px; height:30px; border-radius:50%; margin-right:10px;">` : ''}${studentName}</td>`;
      row += `<td>${l.date}</td>
<td>${l.task}</td>
<td>${l.hours}</td>
<td>${l.proof ? `<img src="${l.proof}" style="max-width:100px; max-height:100px;">` : ''}</td>
<td>${l.status}</td>`;
      if(isAdmin && l.status === 'Pending'){
        row += `<td><button onclick="approveLog('${l.id}')" style="background:#22c55e; margin-right:5px;">Approve</button><button onclick="rejectLog('${l.id}')" style="background:#ef4444;">Reject</button></td>`;
      } else if(!isAdmin && l.status === 'Pending'){
        row += `<td><button onclick="deleteLog('${l.id}')" style="background:#ef4444;">Delete</button></td>`;
      } else {
        row += `<td></td>`;
      }
      row += '</tr>';
      table.innerHTML += row;
    });

    if(!isAdmin){
      let percent = (total / 500) * 100;
      const barElement = document.getElementById('bar');
      const totalElement = document.getElementById('total');

      if(barElement) barElement.style.width = `${percent}%`;
      if(totalElement) totalElement.innerText = total;
    }
  } catch(error) {
    console.error('Error in renderLogs:', error);
  }
}

async function approveLog(id){
  const { error } = await supabaseClient.from('logs').update({ status: 'Approved' }).eq('id', id);
  if(handleError(error)) return;
  await renderLogs();
  alert('Log approved!');
}

async function rejectLog(id){
  const { error } = await supabaseClient.from('logs').delete().eq('id', id);
  if(handleError(error)) return;
  await renderLogs();
  alert('Log rejected and removed!');
}

async function deleteLog(id){
  if(!confirm('Delete this log?')) return;
  const { error } = await supabaseClient.from('logs').delete().eq('id', id).eq('user_id', currentUser.id);
  if(handleError(error)) return;
  await renderLogs();
}

async function renderPendingUsers(){
  if(!supabaseClient) return console.error('Database connection failed');
  
  let table = document.getElementById('pendingUsers');
  if(!table) return;
  table.innerHTML = '<tr><th>Student Number</th><th>Name</th><th>Email</th><th>Picture</th><th>Registration Date</th><th>Action</th></tr>';

  const { data: pendingUsers, error } = await supabaseClient.from('users').select('*').eq('role', 'student').eq('approved', false).order('registration_date', { ascending: false });
  if(handleError(error)) return;

  (pendingUsers || []).forEach((u) => {
    let row = `<tr>
<td>${u.student_number}</td>
<td>${u.name}</td>
<td>${u.email}</td>
<td>${u.picture ? `<img src="${u.picture}" style="width:50px; height:50px; border-radius:50%;">` : 'No Picture'}</td>
<td>${u.registration_date}</td>
<td>
  <button onclick="approveUser('${u.student_number}')" style="background:#22c55e; margin-right:5px;">Approve</button>
  <button onclick="rejectUser('${u.student_number}')" style="background:#ef4444;">Reject</button>
</td>
</tr>`;
    table.innerHTML += row;
  });
}

async function approveUser(studentNumber){
  const { error } = await supabaseClient.from('users').update({ approved: true }).eq('student_number', studentNumber);
  if(handleError(error)) return;
  alert('User approved!');
  await renderPendingUsers();
}

async function renderApprovedStudents(){
  if(!supabaseClient) return console.error('Database connection failed');
  
  let table = document.getElementById('approvedStudents');
  if(!table) return;
  table.innerHTML = '';

  const { data: approvedUsers, error } = await supabaseClient.from('users').select('*').eq('role', 'student').eq('approved', true).order('name', { ascending: true });
  if(handleError(error)) return;

  (approvedUsers || []).forEach((u) => {
    let row = `<tr>
<td>${u.picture ? `<img src="${u.picture}" style="width:30px; height:30px; border-radius:50%; margin-right:10px;">` : ''}${u.name}</td>
<td>${u.student_number}</td>
<td>${u.email}</td>
<td>${u.location}</td>
<td><button onclick="removeStudentAccount('${u.student_number}')" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;">Remove</button></td>
</tr>`;
    table.innerHTML += row;
  });
}

async function removeStudentAccount(studentNumber){
  if(!confirm('Remove this student account and all related logs?')) return;

  const user = await getUserByStudentNumber(studentNumber);
  if(!user) return alert('Student not found.');

  const { error } = await supabaseClient.from('users').delete().eq('id', user.id);
  if(handleError(error)) return;

  await updateAdminOverview();
  await renderApprovedStudents();
  await renderLogs();
  alert('Student account removed.');
}

async function rejectUser(studentNumber){
  if(!confirm('Are you sure you want to reject this user registration? This will permanently remove their account.')) return;

  const { error } = await supabaseClient.from('users').delete().eq('student_number', studentNumber);
  if(handleError(error)) return;

  alert('User registration rejected and removed!');
  await renderPendingUsers();
}

async function renderLocationMonitoring(){
  if(!supabaseClient) return console.error('Database connection failed');
  
  let table = document.getElementById('locationTable');
  if(!table) return;

  let isProfileView = window.profileView || false;
  let header = document.getElementById('tableHeader');
  if(header){
    header.innerHTML = isProfileView ? '<tr><th>Student Name</th><th>Student ID</th><th>Location</th><th>Total Hours</th><th>Profile</th></tr>' : '<tr><th>Student Name</th><th>Student ID</th><th>Location</th><th>Status</th><th>Last Active</th></tr>';
  }

  table.innerHTML = isProfileView ? '<tr><th>Student Name</th><th>Student ID</th><th>Location</th><th>Total Hours</th><th>Profile</th></tr>' : '<tr><th>Student Name</th><th>Student ID</th><th>Location</th><th>Status</th><th>Last Active</th></tr>';

  const { data: students, error } = await supabaseClient.from('users').select('*').eq('role', 'student').eq('approved', true).order('name', { ascending: true });
  if(handleError(error)) return;

  let filteredUsers = students || [];
  let filterValue = document.getElementById('filterLocation') ? document.getElementById('filterLocation').value : '';
  if(filterValue) filteredUsers = filteredUsers.filter(u => u.location === filterValue);

  let logsMap = {};
  if(isProfileView && filteredUsers.length){
    const userIds = filteredUsers.map(u => u.id);
    const { data: logsData, error: logsError } = await supabaseClient.from('logs').select('user_id, hours, status').in('user_id', userIds);
    if(handleError(logsError)) return;
    (logsData || []).forEach(l => {
      if(l.status === 'Approved'){
        logsMap[l.user_id] = (logsMap[l.user_id] || 0) + Number(l.hours);
      }
    });
  }

  filteredUsers.forEach((u) => {
    if(isProfileView){
      let totalHours = logsMap[u.id] || 0;
      let row = `<tr>
<td><a href="#" onclick="showStudentProfile('${u.email}')" style="color:#3b82f6; text-decoration:none;">${u.picture ? `<img src="${u.picture}" style="width:30px; height:30px; border-radius:50%; margin-right:10px;">` : ''}${u.name}</a></td>
<td>${u.student_number}</td>
<td>${u.location}</td>
<td>${totalHours}</td>
<td><button onclick="showStudentProfile('${u.email}')" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">View Profile</button></td>
</tr>`;
      table.innerHTML += row;
    } else {
      let statusIndicator = u.is_active ? '<span style="color:#22c55e; font-weight:bold;">? ACTIVE</span>' : '<span style="color:#ef4444;">? Offline</span>';
      let row = `<tr>
<td><a href="#" onclick="showStudentProfile('${u.email}')" style="color:#3b82f6; text-decoration:none;">${u.picture ? `<img src="${u.picture}" style="width:30px; height:30px; border-radius:50%; margin-right:10px;">` : ''}${u.name}</a></td>
<td>${u.student_number}</td>
<td>${u.location}</td>
<td>${statusIndicator}</td>
<td>${u.last_active || 'N/A'}</td>
</tr>`;
      table.innerHTML += row;
    }
  });
}

async function showStudentProfile(email){
  const user = await getUserByEmail(email);
  if(!user) return;

  const { data: studentLogs, error } = await supabaseClient.from('logs').select('*').eq('user_id', user.id).order('date', { ascending: false });
  if(handleError(error)) return;

  let totalHours = (studentLogs || []).filter(l => l.status === 'Approved').reduce((sum, l) => sum + Number(l.hours), 0);
  let pendingHours = (studentLogs || []).filter(l => l.status === 'Pending').reduce((sum, l) => sum + Number(l.hours), 0);

  let historyRows = (studentLogs || []).length ? (studentLogs || []).map(l => `
    <tr>
      <td style="border:1px solid #ddd; padding:8px;">${l.date}</td>
      <td style="border:1px solid #ddd; padding:8px;">${l.task}</td>
      <td style="border:1px solid #ddd; padding:8px;">${l.hours}</td>
      <td style="border:1px solid #ddd; padding:8px;">${l.status}</td>
      <td style="border:1px solid #ddd; padding:8px;">${l.proof ? `<a href="#" onclick="showFullProof('${l.proof}')" style="display:inline-block;">` + `<img src="${l.proof}" style="max-width:100px; cursor:pointer; border-radius:6px;">` + `</a>` : 'No proof'}</td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="5" style="padding:16px; text-align:center; color:#555;">No log history available.</td>
    </tr>
  `;

  let profileHTML = `
    <div id="profileModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px;">
      <div style="background:#fff; color:#111; width:100%; max-width:760px; max-height:90%; overflow:auto; border-radius:16px; box-shadow:0 24px 60px rgba(0,0,0,0.35); padding:24px; position:relative;">
        <button onclick="closeProfileModal()" style="position:absolute; top:16px; right:16px; width:32px; height:32px; border:none; border-radius:50%; background:#ef4444; color:#fff; cursor:pointer; font-weight:bold;">�</button>
        <h2 style="margin-top:0; margin-bottom:18px; display:inline-block;">Student Profile</h2>
        <button onclick="downloadStudentHistory('${email}')" style="margin-left:16px; padding:8px 14px; background:#2563eb; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:14px;">Download History</button>
        <div style="display:grid; grid-template-columns:140px 1fr; gap:20px; align-items:start; margin-bottom:20px;">
          ${user.picture ? `<img src="${user.picture}" style="width:140px; height:140px; object-fit:cover; border-radius:18px;">` : `<div style="width:140px; height:140px; background:#f3f4f6; border-radius:18px; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size:14px;">No Photo</div>`}
          <div style="display:grid; gap:8px; font-size:15px;">
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Student ID:</strong> ${user.student_number}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Location:</strong> ${user.location}</p>
            <p><strong>Registration Date:</strong> ${user.registration_date}</p>
            <p><strong>Total Hours:</strong> ${totalHours}/500</p>
            <p><strong>Pending Hours:</strong> ${pendingHours}</p>
          </div>
        </div>
        <h3 style="margin-bottom:12px;">Log History</h3>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <thead>
            <tr>
              <th style="border:1px solid #ddd; padding:10px; text-align:left; background:#f9fafb;">Date</th>
              <th style="border:1px solid #ddd; padding:10px; text-align:left; background:#f9fafb;">Task</th>
              <th style="border:1px solid #ddd; padding:10px; text-align:left; background:#f9fafb;">Hours</th>
              <th style="border:1px solid #ddd; padding:10px; text-align:left; background:#f9fafb;">Status</th>
              <th style="border:1px solid #ddd; padding:10px; text-align:left; background:#f9fafb;">Proof</th>
            </tr>
          </thead>
          <tbody>
            ${historyRows}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', profileHTML);
}

function closeProfileModal(){
  const modal = document.getElementById('profileModal');
  if(modal) modal.remove();
}

function showFullProof(src){
  let proofHTML = `
    <div id="proofModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:3000; display:flex; align-items:center; justify-content:center; padding:20px;">
      <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
        <button onclick="document.getElementById('proofModal')?.remove()" style="position:absolute; top:20px; right:20px; width:40px; height:40px; border:none; border-radius:50%; background:#ef4444; color:#fff; font-size:20px; cursor:pointer; z-index:2;">�</button>
        <img src="${src}" style="max-width:95%; max-height:95%; width:auto; height:auto; object-fit:contain; border-radius:12px; box-shadow:0 16px 40px rgba(0,0,0,0.5);" />
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', proofHTML);
}

async function downloadStudentHistory(email){
  const user = await getUserByEmail(email);
  if(!user) return alert('Student not found.');

  const { data: studentLogs, error } = await supabaseClient.from('logs').select('*').eq('user_id', user.id).order('date', { ascending: false });
  if(handleError(error)) return;
  if(!studentLogs || !studentLogs.length){
    alert('No log history available for this student.');
    return;
  }

  let csvRows = [
    ['Date','Task','Hours','Status','Proof']
  ];

  studentLogs.forEach(l => {
    csvRows.push([
      l.date,
      l.task.replace(/"/g, '""'),
      l.hours,
      l.status,
      l.proof ? 'Yes' : 'No'
    ]);
  });

  let csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  let link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${email.replace(/[^a-z0-9]/gi, '_')}_log_history.csv`;
  link.click();
}

function exportPDF(){
  let content = 'OJT REPORT\nTotal Hours: ' + document.getElementById('total').innerText;
  let blob = new Blob([content], { type: 'text/plain' });
  let link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ojt-report.txt';
  link.click();
}

async function updateAdminOverview(){
  const { data: approvedUsers, error: approvedError } = await supabaseClient.from('users').select('id').eq('role', 'student').eq('approved', true);
  if(handleError(approvedError)) return;
  const { data: pendingUsers, error: pendingError } = await supabaseClient.from('users').select('id').eq('role', 'student').eq('approved', false);
  if(handleError(pendingError)) return;
  document.getElementById('totalStudents').innerText = approvedUsers ? approvedUsers.length : 0;
  document.getElementById('pendingCount').innerText = pendingUsers ? pendingUsers.length : 0;
}

document.addEventListener('DOMContentLoaded', async function(){
  // Dashboard-specific initialization
  if(window.location.pathname.includes('studentdashboard.html') || window.location.pathname.includes('admindashboard.html')){
    try {
      await refreshCurrentUser();
      if(!currentUser) {
        console.error('No current user found, redirecting to login');
        window.location.href = 'login.html';
        return;
      }

      // Small delay to ensure DOM is fully ready
      setTimeout(() => {
        showDashboard();
        renderLogs();
      }, 100);

    } catch(error) {
      console.error('Dashboard initialization failed:', error);
      alert('Failed to load dashboard. Please try refreshing the page.');
    }
  }
});
