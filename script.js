function toggleDropdown(id) {
    // Pobierz element, który chcemy otworzyć/zamknąć
    const targetContent = document.getElementById(id);
    
    // Pobierz wszystkie sekcje treści i wszystkie przyciski
    const allContents = document.querySelectorAll('.content');
    const allButtons = document.querySelectorAll('.main-btn');

    // 1. Pętla po wszystkich sekcjach, żeby zamknąć te nieaktywne (Efekt Akordeonu)
    allContents.forEach(content => {
        // Znajdź przycisk przypisany do danej sekcji (jest bezpośrednio nad nią)
        const btn = content.previousElementSibling;

        if (content.id === id) {
            // To jest sekcja, którą kliknęliśmy
            if (content.style.maxHeight) {
                // Jeśli była otwarta -> ZAMKNIJ
                content.style.maxHeight = null;
                if (btn) btn.classList.remove('active');
            } else {
                // Jeśli była zamknięta -> OTWÓRZ
                content.style.maxHeight = content.scrollHeight + "px";
                if (btn) btn.classList.add('active');
            }
        } else {
            // To nie jest kliknięta sekcja -> ZAMKNIJ JĄ (żeby tylko jedna była otwarta)
            content.style.maxHeight = null;
            if (btn) btn.classList.remove('active');
        }
    });
}
