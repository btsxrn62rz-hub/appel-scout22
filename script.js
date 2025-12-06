const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbylDOZOcMB7SqQ3aMR3skS6AfJrLMVVGqsrujHFsU4LyWsqnErr9qNiOP8KMEhB8cKr/exec"; 

let louveteaux = [];
let eclaireurs = [];

document.addEventListener('DOMContentLoaded', () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date-jour').innerText = new Date().toLocaleDateString('fr-FR', options);
    chargerListesDepuisGoogle();
});

function chargerListesDepuisGoogle() {
    fetch(APPS_SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                louveteaux = data.louveteaux;
                eclaireurs = data.eclaireurs;
                genererListe('liste-louveteaux', louveteaux, 'Louveteaux');
                genererListe('liste-eclaireurs', eclaireurs, 'Eclaireurs');
            } else {
                alert("Erreur chargement : " + data.message);
            }
        })
        .catch(error => { console.error(error); });
}

function genererListe(elementId, tableauObjets, groupeNom) {
    const ul = document.getElementById(elementId);
    ul.innerHTML = "";
    
    if (tableauObjets.length === 0) {
        ul.innerHTML = "<li>Aucun inscrit trouvé.</li>";
        return;
    }

    tableauObjets.forEach(enfant => {
        let li = document.createElement('li');
        
        li.innerHTML = `
            <span class="nom-eleve">${enfant.nom}</span>
            <div class="item-actions">
                <button class="btn-info" onclick="ouvrirFiche(event, '${enfant.nom}', '${groupeNom}')">ℹ️</button>
                <button class="btn-mini" onclick="modifierEnfant(event, '${enfant.nom}', '${groupeNom}')">✏️</button>
                <button class="btn-mini" onclick="supprimerEnfant(event, '${enfant.nom}', '${groupeNom}')">🗑️</button>
            </div>
        `;

        li.onclick = function(e) {
            if (e.target.tagName === 'BUTTON') return;
            this.classList.toggle('present');
        };
        ul.appendChild(li);
    });
}

// --- GESTION DE LA MODALE ---
function ouvrirFiche(event, nomCible, groupe) {
    event.stopPropagation();
    
    let liste = (groupe === 'Louveteaux') ? louveteaux : eclaireurs;
    let enfant = liste.find(e => e.nom === nomCible);

    if (enfant) {
        document.getElementById('modal-nom').innerText = enfant.nom;
        document.getElementById('modal-parents').innerText = enfant.parents || "Non renseigné";
        
        // Téléphone
        let telDisplay = enfant.tel || "Non renseigné";
        document.getElementById('modal-tel').innerText = telDisplay;
        document.getElementById('modal-tel-link').href = enfant.tel ? "tel:" + enfant.tel : "#";

        // Mail
        let mailDisplay = enfant.mail || "Non renseigné";
        document.getElementById('modal-mail').innerText = mailDisplay;
        document.getElementById('modal-mail-link').href = enfant.mail ? "mailto:" + enfant.mail : "#";

        // Paiement
        let paiementElem = document.getElementById('modal-paiement');
        paiementElem.innerText = enfant.paiement;
        if(enfant.paiement.toString().toUpperCase().includes('OK')) paiementElem.style.color = "green";
        else paiementElem.style.color = "orange";

        document.getElementById('modal-medical').innerText = enfant.medical || "Aucune info";

        document.getElementById('modal-fiche').style.display = 'flex';
    }
}

function fermerModal() {
    document.getElementById('modal-fiche').style.display = 'none';
}

// --- AUTRES FONCTIONS (Edit, Delete, Export...) ---

function modifierEnfant(event, ancienNom, groupe) {
    event.stopPropagation();
    let nouveauNom = prompt("Modifier le nom de " + ancienNom + " :", ancienNom);
    if (nouveauNom && nouveauNom !== ancienNom) {
        envoyerAction({ action: 'EDIT', groupe: groupe, nom: ancienNom, nouveauNom: nouveauNom }, `Nom modifié`);
    }
}

function supprimerEnfant(event, nom, groupe) {
    event.stopPropagation();
    if (confirm("Supprimer " + nom + " ?")) {
        envoyerAction({ action: 'DELETE', groupe: groupe, nom: nom }, `Supprimé`);
    }
}

function ajouterEnfant() {
    const nom = document.getElementById('nouveau-nom').value.trim();
    const groupe = document.getElementById('nouveau-groupe').value;
    if (!nom) return alert("Nom vide !");
    envoyerAction({ action: 'ADD', nom: nom, groupe: groupe }, `Ajouté`);
}

function exporterAppel() {
    let csvData = "\uFEFFGroupe;Nom;Statut;Date\n";
    const dateJour = new Date().toLocaleDateString('fr-FR');
    const filename = "Appel_Scout_" + dateJour.replace(/\//g, '-') + ".csv";

    function process(liste, groupeNom) {
        const ul = document.getElementById(groupeNom === 'Louveteau' ? 'liste-louveteaux' : 'liste-eclaireurs');
        const listItems = ul.getElementsByTagName('li');
        let localCsv = "";
        for (let item of listItems) {
            if (item.innerText.includes("Aucun inscrit") || item.innerText.includes("Chargement")) continue;
            let nomEleve = item.querySelector('.nom-eleve').innerText;
            let statut = item.classList.contains('present') ? "PRESENT" : "ABSENT";
            localCsv += `${groupeNom};${nomEleve};${statut};${dateJour}\n`;
        }
        return localCsv;
    }

    let csv1 = process(louveteaux, 'Louveteau');
    let csvFinal = csvData + csv1;
    
    // Pour les éclaireurs
    const ulEc = document.getElementById('liste-eclaireurs');
    const itemsEc = ulEc.getElementsByTagName('li');
    for (let item of itemsEc) {
        if (item.innerText.includes("Aucun") || item.innerText.includes("Chargement")) continue;
        let nom = item.querySelector('.nom-eleve').innerText;
        let st = item.classList.contains('present') ? "PRESENT" : "ABSENT";
        csvFinal += `Eclaireur;${nom};${st};${dateJour}\n`;
    }

    envoyerAction({ action: 'EXPORT', csvData: csvFinal, filename: filename }, "Exporté sur Drive");
}

function envoyerAction(payload, msg) {
    document.body.style.cursor = "wait";
    fetch(APPS_SCRIPT_URL, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload)
    }).then(() => {
        document.body.style.cursor = "default";
        alert("✅ " + msg);
        setTimeout(() => location.reload(), 1000);
    }).catch(e => alert("Erreur " + e));
}

function openTab(evt, groupName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) { tabcontent[i].style.display = "none"; }
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) { tablinks[i].className = tablinks[i].className.replace(" active", ""); }
    document.getElementById(groupName).style.display = "block";
    evt.currentTarget.className += " active";
}
