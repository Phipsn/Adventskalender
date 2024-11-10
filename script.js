// Countdown logic
const targetDate = new Date("2024-12-01T18:00:00").getTime();

function updateCountdown() {
    const now = new Date().getTime();
    const timeLeft = targetDate - now;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    document.getElementById("timer").innerText = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    if (timeLeft < 0) {
        document.getElementById("timer").innerText = "Das nächste Rätsel ist jetzt verfügbar!";
    }
}

setInterval(updateCountdown, 1000);

// FAQ collapse logic
const faqQuestions = document.querySelectorAll(".faq-question");

faqQuestions.forEach(question => {
    question.addEventListener("click", () => {
        const answer = question.nextElementSibling;
        const arrow = question.querySelector('.arrow');

        if (answer.style.display === "block") {
            answer.style.display = "none";
        } else {
            answer.style.display = "block";
        }

        question.classList.toggle('open');
    });
});

// Kontaktformular Logik
document.getElementById("contactForm").addEventListener("submit", function(event) {
    event.preventDefault();
    
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const message = document.getElementById("message").value;
    const statusDiv = document.getElementById("formStatus");

    if (name && email && message) {
        statusDiv.innerText = "Vielen Dank für deine Nachricht! Wir werden uns bald bei dir melden.";
        statusDiv.style.color = "green";
    } else {
        statusDiv.innerText = "Bitte fülle alle Felder aus.";
        statusDiv.style.color = "red";
    }

    document.getElementById("contactForm").reset();
});

// script.js
window.onscroll = function() { toggleScrollToTopButton() };

function toggleScrollToTopButton() {
    const scrollToTopBtn = document.getElementById("scrollToTopBtn");
    if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
        scrollToTopBtn.style.display = "block";
    } else {
        scrollToTopBtn.style.display = "none";
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// script.js

let isGerman = true;

function toggleLanguage() {
    isGerman = !isGerman;
    document.getElementById("languageToggle").innerText = isGerman ? "🇩🇪 DE" : "🇬🇧 EN";

    // Texte auf Deutsch oder Englisch wechseln
    
    // Fortfahren für alle Elemente, die in beiden Sprachen vorkommen
}
