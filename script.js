function toggleDropdown(id) {
    const content = document.getElementById(id);
    const allContent = document.querySelectorAll('.content');

    // Opcjonalne: zamykanie innych przy otwieraniu nowego
    // allContent.forEach(c => { if(c.id !== id) c.style.maxHeight = null; });

    if (content.style.maxHeight) {
        content.style.maxHeight = null;
    } else {
        content.style.maxHeight = content.scrollHeight + "px";
    }
}

// Obsługa motywu
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');

themeToggle.addEventListener('change', () => {
    if (themeToggle.checked) {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        themeLabel.textContent = "Tryb Jasny";
    } else {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        themeLabel.textContent = "Tryb Ciemny";
    }
});