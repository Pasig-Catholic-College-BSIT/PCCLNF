document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('tap-area').addEventListener('click', function() {
        // Add your navigation or next action here
        alert('Continuing to next page...');
        window.location.href = 'next-page.html'; // Uncomment to navigate to next page
    });
});

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('tap-area').addEventListener('click', function() {
        document.body.style.opacity = '0';
        setTimeout(() => {
            window.location.href = 'next-page.html';
        }, 500);
    });
});