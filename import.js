// =====================================================
// IMPORT.JS - XLS/XLSX/CSV import via SheetJS
// Columns: A=Česky, B=Anglicky, C=Výslovnost (IPA), D=Učebnice, E=Téma
// Okruh (kategorie) = "Učebnice — Téma". Pokud chybí, fallback na název listu.
// =====================================================

const ImportManager = {
  parsedSheets: null,

  parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          if (typeof XLSX === 'undefined') {
            reject(new Error('Knihovna SheetJS není načtená. Zkontrolujte připojení k internetu.'));
            return;
          }

          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          const headerKeywords = [
            'czech', 'česky', 'čeština', 'cz', 'cesky', 'cestina', 'slovo',
            'english', 'anglicky', 'angličtina', 'en', 'aj', 'word',
            'výslovnost', 'vyslovnost', 'ipa', 'pronunciation',
            'učebnice', 'ucebnice', 'book', 'textbook',
            'téma', 'tema', 'topic'
          ];
          const isHeader = (row) => {
            if (!row) return false;
            // Header if ANY of the first 5 cells contains a keyword
            for (let i = 0; i < Math.min(5, row.length); i++) {
              if (!row[i]) continue;
              const val = String(row[i]).toLowerCase().trim();
              if (headerKeywords.some(h => val.includes(h))) return true;
            }
            return false;
          };

          const sheets = [];
          let totalWords = 0;

          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            let dataRows = rows;
            if (dataRows.length > 0 && isHeader(dataRows[0])) {
              dataRows = dataRows.slice(1);
            }

            // A=Česky, B=Anglicky, C=Výslovnost, D=Učebnice, E=Téma
            const words = dataRows
              .filter(row => row && row[0] && row[1])
              .map(row => ({
                czech: String(row[0]).trim(),
                english: String(row[1]).trim(),
                pronunciation: row[2] ? String(row[2]).trim() : '',
                textbook: row[3] ? String(row[3]).trim() : '',
                topic: row[4] ? String(row[4]).trim() : ''
              }))
              .filter(w => w.czech.length > 0 && w.english.length > 0);

            if (words.length > 0) {
              sheets.push({ name: sheetName, words });
              totalWords += words.length;
            }
          }

          if (sheets.length === 0 || totalWords === 0) {
            reject(new Error('Soubor neobsahuje žádná platná slovíčka. Zkontrolujte, že sloupec A je česky a sloupec B anglicky.'));
            return;
          }

          // Group all words across all sheets by category = "Učebnice — Téma"
          const groups = new Map();
          for (const sheet of sheets) {
            for (const w of sheet.words) {
              const tb = w.textbook.trim();
              const tp = w.topic.trim();
              let catName;
              if (tb && tp) catName = `${tb} — ${tp}`;
              else if (tb) catName = tb;
              else if (tp) catName = tp;
              else catName = sheet.name; // fallback: legacy 2-col files

              if (!groups.has(catName)) groups.set(catName, []);
              groups.get(catName).push(w);
            }
          }

          const grouped = Array.from(groups.entries()).map(([name, words]) => ({ name, words }));

          this.parsedSheets = grouped;
          resolve(grouped);
        } catch (err) {
          reject(new Error('Chyba při čtení souboru: ' + err.message));
        }
      };

      reader.onerror = () => {
        reject(new Error('Chyba při čtení souboru.'));
      };

      reader.readAsArrayBuffer(file);
    });
  },

  importAll(iconMap) {
    if (!this.parsedSheets || this.parsedSheets.length === 0) {
      return { added: 0, skipped: 0, categories: 0, error: 'Žádná data k importu' };
    }

    let totalAdded = 0;
    let totalSkipped = 0;
    let categoriesCreated = 0;

    for (const group of this.parsedSheets) {
      const icon = (iconMap && iconMap[group.name]) || '📚';
      const category = {
        id: DataManager.generateId('cat'),
        name: group.name,
        nameEn: '',
        icon: icon,
        createdAt: new Date().toISOString()
      };

      const result = DataManager.addWords(category, group.words);
      totalAdded += result.added;
      totalSkipped += result.skipped;
      if (result.added > 0) categoriesCreated++;
    }

    this.parsedSheets = null;
    return { added: totalAdded, skipped: totalSkipped, categories: categoriesCreated };
  }
};
