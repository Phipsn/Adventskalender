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
    document.querySelector("header h1").innerText = isGerman 
        ? "Adventskalender Quiz – Rätselspaß bis Weihnachten!"
        : "Advent Calendar Quiz – Puzzle Fun until Christmas!";
        
    document.querySelector("header p").innerText = isGerman
        ? "Kauf dir jetzt deinen Kalender für nur 4,95€ und gewinne einen Goldbarren im Wert von 500€!"
        : "Buy your calendar now for only €4.95 and win a gold bar worth €500!";
        
    document.querySelector("#calendar h2").innerText = isGerman ? "Nächste Rätsel:" : "Next Puzzles:";
    document.querySelector("#rules h2").innerText = isGerman ? "Wie funktioniert der Adventskalender?" : "How does the Advent Calendar work?";
    document.querySelector("#prizes h2").innerText = isGerman ? "Preise" : "Prizes";
    document.querySelector("#faqs h2").innerText = isGerman ? "Häufig gestellte Fragen (FAQs)" : "Frequently Asked Questions (FAQs)";
    document.querySelector("#contact h2").innerText = isGerman ? "Kontaktiere uns" : "Contact Us";
    
    // Beispiel für weiteren Text: Sprachumschaltung in Liste
    const ruleListItems = document.querySelectorAll("#rules li");
    ruleListItems[0].innerText = isGerman 
        ? "Jeden Mittwoch und Sonntag um 18:00 Uhr gibt es ein Rätsel." 
        : "Every Wednesday and Sunday at 6:00 PM, there’s a new puzzle.";
    ruleListItems[1].innerText = isGerman 
        ? "An anderen Tagen gibt es schöne Sprüche, Geschichten oder Gutscheine." 
        : "On other days, you’ll find lovely quotes, stories, or coupons.";
    // Fortfahren für alle Elemente, die in beiden Sprachen vorkommen
}

document.querySelectorAll('.new-riddle').forEach(day => {
    day.addEventListener('click', () => {
        alert('New riddle is live! Check it out!');
    });
});