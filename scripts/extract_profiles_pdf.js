const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const pdfPath = "C:\\Users\\ACPO Empreendimentos\\CONSTRUTORA ACPO LTDA\\Recursos Humanos - Documentos\\Gestão de Pessoas\\5. Plano de Carreira\\4. Perfil de Competências\\Perfil de competências 2025 Modelo rev_34.pdf";

async function extractProfiles() {
    console.log("Reading PDF...");
    let dataBuffer = fs.readFileSync(pdfPath);
    let data = await pdf(dataBuffer);
    
    console.log("PDF Pages: " + data.numpages);
    const text = data.text;

    // Save text for debugging
    fs.writeFileSync('pdf_text_dump.txt', text, 'utf-8');

    // We will parse the text. Looking for pattern:
    // "Código do perfil" then "C-XXXX"
    const lines = text.split('\n');
    let profiles = [];
    let currentProfile = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // Find profile code
        const codeMatch = line.match(/C-\d{4}/);
        if (codeMatch && lines[i-1] && lines[i-1].includes('Código do perfil')) {
            // Found a profile start
            let title = lines[i-2] || ""; 
            if(title.trim() === "CBO") title = lines[i-3] || ""; // Sometimes title is above CBO
            // It's a bit messy, let's just capture the code and use regex on the full text block later if easier.
            // For now, let's just collect all codes to see how many we find
            profiles.push(codeMatch[0]);
        }
    }
    console.log("Found codes count: " + profiles.length);
    console.log(profiles);
}

extractProfiles().catch(console.error);
