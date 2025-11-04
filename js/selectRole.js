function navigateTo(path) {
  if (!path) return;
  console.log('Navigating to', path);
  window.location.href = path;
}

document.addEventListener('DOMContentLoaded', () => {
  const adminBtn = document.getElementById('role-admin');
  const facultyBtn = document.getElementById('role-faculty');
  const studentBtn = document.getElementById('role-student');

  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      navigateTo('admin.html');
    });
  }

  if (facultyBtn) {
    facultyBtn.addEventListener('click', () => {
      navigateTo('faculty-student.html');
    });
  }

  if (studentBtn) {
    studentBtn.addEventListener('click', () => {
      navigateTo('faculty-student.html');
    });
  }
});