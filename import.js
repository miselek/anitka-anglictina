// =====================================================
// IMPORT.JS - XLS/XLSX/CSV import via SheetJS
//
// Header-driven column mapping. Recognized headers (case-insensitive):
//   Česky / Cesky / Čeština / CZ      → czech (required)
//   Anglicky / English / EN / AJ      → english (required)
//   Výslovnost / IPA / Pronunciation  → pronunciation
//   Učebnice / Textbook / Book        → textbook
//   Téma / Tema / Topic / Kapitola    → topic
//   Výskytů / Frequency / Count / N   → frequency (used for quiz priority)
//
// Okruh (kategorie) = "Učebnice — Téma" (fallback na sheet name).
// =====================================================

const ImportManager = {
  parsedSheets: null,

  COLUMN_ALIASES: {
    czech:         ['cesky', 'česky', 'cestina', 'čeština', 'cz', 'slovo', 'czech'],
    english:       ['anglicky', 'angličtina', 'anglictina', 'angl', 'en', 'aj', 'english', 'word'],
    pronunciation: ['vyslovnost', 'výslovnost', 'ipa', 'pronunciation', 'výsl', 'vysl', 'phon'],
    textbook:      ['ucebnice', 'učebnice', 'kniha', 'book', 'textbook', 'source'],
    topic:         ['tema', 'téma', 'topic', 'kapitola', 'chapter', 'lesson'],
    frequency:     ['vyskytu', 'výskytů', 'výskyty', 'pocet', 'počet', 'freq', 'frequency', 'count', 'n', 'výskyt', 'vyskyt']
  },

  // Map abbreviated textbook codes to readable names. Variants ending in
  // -NE are collapsed to the same base (different editions of the same book).
  TEXTBOOK_MAP: {
    'hh1': 'Happy House 1',
    'hh2': 'Happy House 2',
    'hs1': 'Happy Street 1',
    'hs2': 'Happy Street 2'
  },

  _normalizeTextbook(raw) {
    if (!raw) return '';
    // If multiple textbooks separated by ",", take the first one (canonical).
    const first = String(raw).split(',')[0].trim();
    // Strip variant suffix (-NE) so HS1 and HS1-NE merge into one category.
    const base = first.replace(/-NE$/i, '').trim();
    return this.TEXTBOOK_MAP[base.toLowerCase()] || base;
  },

  _normalizeTopic(raw) {
    if (!raw) return '';
    // Topics in source data are sometimes slash-separated lists of multiple
    // themes a word fits into. Take the first one as canonical.
    return String(raw).split('/')[0].trim();
  },

  _normalize(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/[(){}\[\]:;,.!?"']/g, '')
      .trim();
  },

  _mapHeader(row) {
    // Returns { czech: 0, english: 1, ... } based on which cell matches which field.
    const mapping = {};
    if (!row) return mapping;
    for (let i = 0; i < row.length; i++) {
      const cell = this._normalize(row[i]);
      if (!cell) continue;
      for (const [field, aliases] of Object.entries(this.COLUMN_ALIASES)) {
        if (field in mapping) continue;
        if (aliases.some(a => cell === a || cell.includes(a))) {
          mapping[field] = i;
          break;
        }
      }
    }
    return mapping;
  },

  _isHeader(row) {
    if (!row) return false;
    const mapping = this._mapHeader(row);
    // Header if BOTH czech and english columns are recognized
    return 'czech' in mapping && 'english' in mapping;
  },

  _hasAnyHeaderKeyword(row) {
    if (!row) return false;
    for (let i = 0; i < row.length; i++) {
      const cell = this._normalize(row[i]);
      if (!cell) continue;
      for (const aliases of Object.values(this.COLUMN_ALIASES)) {
        if (aliases.some(a => cell === a || cell.includes(a))) return true;
      }
    }
    return false;
  },

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

          const sheets = [];
          let totalWords = 0;

          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            let mapping = null;
            let dataRows = rows;
            const firstRow = rows[0];
            if (dataRows.length > 0 && this._isHeader(firstRow)) {
              mapping = this._mapHeader(firstRow);
              dataRows = dataRows.slice(1);
            } else if (this._hasAnyHeaderKeyword(firstRow)) {
              // Sheet has a header but lacks Czech/English columns. Almost
              // certainly a summary sheet (e.g., "Přehled"), not vocabulary.
              continue;
            } else {
              // No header at all — positional fallback for legacy files.
              mapping = { czech: 0, english: 1, pronunciation: 2, textbook: 3, topic: 4, frequency: 5 };
            }

            const words = dataRows
              .map(row => {
                const cz = row[mapping.czech];
                const en = row[mapping.english];
                if (!cz || !en) return null;
                const freqRaw = mapping.frequency !== undefined ? row[mapping.frequency] : '';
                const freq = parseInt(String(freqRaw).trim(), 10);
                const textbookRaw = mapping.textbook !== undefined && row[mapping.textbook]
                  ? String(row[mapping.textbook]).trim() : '';
                return {
                  czech: String(cz).trim(),
                  english: String(en).trim(),
                  pronunciation: mapping.pronunciation !== undefined && row[mapping.pronunciation]
                    ? String(row[mapping.pronunciation]).trim() : '',
                  textbook: this._normalizeTextbook(textbookRaw),
                  topic: mapping.topic !== undefined && row[mapping.topic]
                    ? this._normalizeTopic(row[mapping.topic]) : '',
                  frequency: Number.isFinite(freq) && freq > 0 ? freq : 0
                };
              })
              .filter(w => w && w.czech && w.english);

            if (words.length > 0) {
              sheets.push({ name: sheetName, words });
              totalWords += words.length;
            }
          }

          if (sheets.length === 0 || totalWords === 0) {
            reject(new Error('Soubor neobsahuje žádná platná slovíčka. Zkontrolujte, že obsahuje sloupce "Česky" a "Anglicky".'));
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
              else catName = sheet.name;

              if (!groups.has(catName)) groups.set(catName, []);
              groups.get(catName).push(w);
            }
          }

          // Sort each group's words by frequency DESC so the highest-freq
          // ones are loaded first (matters for sequential addWords + UI).
          for (const [name, ws] of groups.entries()) {
            ws.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
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
