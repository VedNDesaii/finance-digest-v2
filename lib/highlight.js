// Highlight the key terms in a market explanation so it's easy to scan:
//   · company / index names  → bold (fd-ent)
//   · + % and inflows         → green chip (fd-n up)
//   · − %                     → red chip   (fd-n dn)
//   · levels & neutral figures→ blue chip  (fd-n ac)
// Returns an HTML string for dangerouslySetInnerHTML. The input is our own
// AI-written market text (not user input); it is HTML-escaped first anyway.

const ENTITIES = [
  'Bank Nifty', 'Nifty 50', 'Nifty', 'Sensex', 'S&P 500', 'Nasdaq', 'Dow Jones', 'Dow',
  'Reliance', 'HDFC Bank', 'HDFC', 'ICICI Bank', 'ICICI', 'TCS', 'Infosys', 'State Bank', 'SBI',
  'Bharti Airtel', 'Airtel', 'ITC', 'Larsen & Toubro', 'L&T', 'Axis Bank', 'Axis', 'Kotak Mahindra', 'Kotak',
  'Hindustan Unilever', 'HUL', 'Bajaj Finance', 'Bajaj Finserv', 'Maruti Suzuki', 'Maruti',
  'Adani Enterprises', 'Adani Ports', 'Adani', 'Tata Steel', 'Tata Motors', 'Tata Consultancy', 'Tata',
  'Wipro', 'Sun Pharma', 'NTPC', 'ONGC', 'Coal India', 'HCL Technologies', 'HCLTech', 'Tech Mahindra',
  'Asian Paints', 'Power Grid', 'UltraTech', 'Nestle', 'Titan', 'JSW Steel', 'IndusInd', 'Grasim',
  'Hindalco', 'Divi', "Dr Reddy", 'Cipla', 'Eicher', 'Britannia', 'Apollo Hospitals', 'LTIMindtree',
  'RBI', 'Fed', 'FII', 'FIIs', 'DII', 'DIIs',
]
const DOWN = /(fell|dropp|slipp|lost|shed|declin|lower|sank|tumbl|slid|down|weak|drag|sold|retreat)/i
const UP   = /(rose|gain|added|up |higher|jump|climb|surg|advanc|rall|led|lift|strong|outperform|bought|recover)/i

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

const ENT_RE = new RegExp('\\b(' + [...ENTITIES].sort((a, b) => b.length - a.length).map(reEsc).join('|') + ')\\b', 'g')

export function highlight(text) {
  if (!text) return ''
  let s = esc(text)

  // 1. percentages — colour by explicit sign, else by the preceding verb
  s = s.replace(/(\b\w+\s+)?([+\-−])?(\d{1,3}(?:\.\d+)?)\s?%/g, (m, pre, sign, num) => {
    let cls = 'ac'
    if (sign === '+') cls = 'up'
    else if (sign === '-' || sign === '−') cls = 'dn'
    else if (pre && DOWN.test(pre)) cls = 'dn'
    else if (pre && UP.test(pre)) cls = 'up'
    return (pre || '') + `<span class="fd-n ${cls}">${sign || ''}${num}%</span>`
  })

  // 2. ₹ amounts (inflows/figures)
  s = s.replace(/₹\s?[\d,]+(?:\.\d+)?\s?(?:lakh crore|crore|cr|lakh)?/gi, m => `<span class="fd-n ac">${m.trim()}</span>`)

  // 3. index levels like 84,312 / 25,804 / 1,840
  s = s.replace(/\b\d{1,3},\d{3}\b/g, m => `<span class="fd-n ac">${m}</span>`)

  // 4. bold company / index names (single pass, longest match first)
  s = s.replace(ENT_RE, '<b class="fd-ent">$1</b>')

  return s
}
