const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const app=fs.readFileSync('src/App.tsx','utf8')
const base=fs.readFileSync('src/styles.css','utf8')
const strip=fs.readFileSync('src/calendar-week-strip.css','utf8')
const polish=fs.readFileSync('src/onboarding-refine.css','utf8')

const diag=ts.transpileModule(app,{
  compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},
  reportDiagnostics:true
}).diagnostics||[]
assert.equal(diag.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,'App TSX must parse')

// The UI shows eight slots, while preserving a single text input for
// keyboard input, backspace, desktop paste and iOS one-time-code autofill.
assert.match(app,/const EMAIL_OTP_LENGTH = 8/)
assert.match(app,/<input className="auth-otp-input"[^>]*type="text"/)
assert.match(app,/autoComplete="one-time-code" inputMode="numeric"/)
assert.match(app,/onChange=\{e => setCode\(e\.target\.value\.replace\(\/\\D\/g, ''\)\.slice\(0, EMAIL_OTP_LENGTH\)\)\}/)
assert.match(app,/onPaste=\{e => \{ const pasted=e\.clipboardData\.getData\('text'\)/)
assert.match(app,/Array\.from\(\{length:EMAIL_OTP_LENGTH\}/)
assert.doesNotMatch(app,/placeholder=\{"0"\.repeat\(EMAIL_OTP_LENGTH\)\}/)
assert.match(polish,/\.auth-screen \.auth-field \.auth-otp-input\s*\{[^}]*position:absolute;[^}]*z-index:2;/s)
assert.match(polish,/\.auth-screen \.auth-otp-grid\s*\{[^}]*grid-template-columns:repeat\(8,minmax\(0,1fr\)\);/s)

// Onboarding finishes from Modules and immediately opens the calendar.
assert.match(app,/if \(step === 4\) \{ finish\(\); return \}/)
assert.match(app,/\[step, setStep\] = useState\(1\)/,'Onboarding starts directly at name entry after OTP')
assert.doesNotMatch(app,/step === 0 && <div className="intro-copy"/,'Redundant Willkommen screen removed')
assert.doesNotMatch(app,/Deine Module und Termine werden geschützt in deinem Supabase-Konto gespeichert\./,'Overexplaining account note removed')
assert.match(app,/stage === 'code' && <p className="auth-footnote">/,'OTP help stays visible only after requesting code')
assert.match(polish,/\.auth-screen \.auth-intro h1/,'Fast geschafft heading has overflow-safe dimensions')
assert.match(fs.readFileSync('src/ui-polish.css','utf8'),/display-mode:standalone/,'Standalone iOS PWA receives safe top padding')
assert.match(fs.readFileSync('src/ui-polish.css','utf8'),/height:calc\(58px \+ env\(safe-area-inset-bottom/,'Mobile bottom nav sits slightly lower')
assert.doesNotMatch(app,/step === 5/)
assert.doesNotMatch(app,/onboard-dots/)
assert.match(app,/onDone=\{d => \{ setData\(d\); setOnboarding\(false\); setPage\('calendar'\) \}\}/)
assert.match(app,/className="onboard-step-motion"/)
assert.match(polish,/@keyframes uf-kinetic-title/)
assert.match(polish,/prefers-reduced-motion:reduce/)
assert.match(polish,/\.onboarding \.aurora\s*\{[^}]*mask-image: linear-gradient\(/s)

// The calendar keeps its data/gesture rules. Only the requested paints change.
assert.match(base,/\.course-past\s*\{\s*filter:none;\s*opacity:\.88;\s*\}/)
assert.match(base,/\.course-past:hover,\.course-past:focus-visible\s*\{\s*filter:none;\s*opacity:1;\s*\}/)
assert.match(strip,/\.uf-week-range\s*\{[^}]*background:#171719;/s)
assert.match(strip,/\.calendar-sticky-header\s*\{[^}]*z-index: 90;/s)
console.log('✔ onboarding/OTP polish: 8-slot paste and autofill, direct calendar entry, kinetic motion, calm halo, retained past colors and dark date strip')
