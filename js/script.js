document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('tap-area').addEventListener('click', function() {
        const body = document.body;
        const overlay = document.querySelector('.overlay');
        
        body.classList.add('fade-out');
        overlay.style.opacity = '0';
        
        setTimeout(() => {
            window.location.href = 'next-page.html';
        }, 500);
    });
});

function navigate(page) {
    const body = document.body;
    const overlay = document.querySelector('.overlay');
    
    body.classList.add('fade-out');
    overlay.style.opacity = '0';
    
    setTimeout(() => {
        window.location.href = page;
    }, 500);
}