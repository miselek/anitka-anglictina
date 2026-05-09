// =====================================================
// IMPORT.JS - XLS/XLSX import via SheetJS
// Format: Column A = English, Column B = Czech
// Each sheet = one category (sheet name = category name)
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

          const isHeader = (row) => {
            if (!row || !row[0]) return false;
            const first = String(row[0]).toLowerCase().trim();
            return ['english', 'anglicky', 'angličtina', 'en', 'aj', 'word',
                    'czech', 'česky', 'čeština', 'cz', 'cesky', 'cestina', 'slovo'].some(h => first.includes(h));
          };

          const sheets = [];
          let totalWords = 0;

          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            let dataRows = rows;
            if (dataRows.length > 0 && isHeader(dataRows[0])) {
              dataRows = dataRows.slice(1);
            }

            // Column A = English, Column B = Czech
            const words = dataRows
              .filter(row => row && row[0] && row[1])
              .map(row => ({
                english: String(row[0]).trim(),
                czech: String(row[1]).trim()
              }))
              .filter(w => w.english.length > 0 && w.czech.length > 0);

            if (words.length > 0) {
              sheets.push({
                name: sheetName,
                words: words
              });
              totalWords += words.length;
            }
          }

          if (sheets.length === 0 || totalWords === 0) {
            reject(new Error('Soubor neobsahuje žádná platná slovíčka. Zkontrolujte, že sloupec A je anglicky a sloupec B česky.'));
            return;
          }

          this.parsedSheets = sheets;
          resolve(sheets);
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

    for (const sheet of this.parsedSheets) {
      const icon = (iconMap && iconMap[sheet.name]) || '📚';
      const category = {
        id: DataManager.generateId('cat'),
        name: sheet.name,
        nameEn: '',
        icon: icon,
        createdAt: new Date().toISOString()
      };

      const result = DataManager.addWords(category, sheet.words);
      totalAdded += result.added;
      totalSkipped += result.skipped;
      if (result.added > 0) categoriesCreated++;
    }

    this.parsedSheets = null;
    return { added: totalAdded, skipped: totalSkipped, categories: categoriesCreated };
  }
};
