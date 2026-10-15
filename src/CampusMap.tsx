import { useState } from 'react'
import { ArrowLeft, Building2, ExternalLink, MapPin, Search } from 'lucide-react'
import './campus-map.css'

type CampusBuilding={code:string;name:string;address:string}

const buildings:CampusBuilding[]=[
  {code:'A',name:'Architekturgebäude',address:'Straße des 17. Juni 152'},
  {code:'A-F',name:'Architekturgebäude – Flachbau',address:'Straße des 17. Juni 152'},
  {code:'A-H',name:'Architekturgebäude – Hochhaus',address:'Straße des 17. Juni 152'},
  {code:'AM',name:'Alte Mineralogie',address:'Hardenbergstraße 38'},
  {code:'B',name:'Bauingenieurgebäude',address:'Hardenbergstraße 40A'},
  {code:'BA',name:'Bauingenieurgebäude – alter Flügel',address:'Hardenbergstraße 40'},
  {code:'BEL',name:'Bell-Villa',address:'Marchstraße 6–8'},
  {code:'BH-A',name:'Bergbau und Hüttenwesen – Altbau',address:'Ernst-Reuter-Platz 1'},
  {code:'BH-N',name:'Bergbau und Hüttenwesen – Neubau',address:'Ernst-Reuter-Platz 1'},
  {code:'BIB',name:'Universitätsbibliothek im Volkswagenhaus',address:'Fasanenstraße 88'},
  {code:'C',name:'Chemiegebäude',address:'Straße des 17. Juni 115'},
  {code:'CIF',name:'Chemical Invention Factory',address:'Marchstraße'},
  {code:'E',name:'Elektrotechnische Institute – Altbau',address:'Einsteinufer 19'},
  {code:'E-N',name:'Elektrotechnik-Neubau',address:'Einsteinufer 17'},
  {code:'EB',name:'Erweiterungsbau',address:'Straße des 17. Juni 145'},
  {code:'EMH',name:'Elektrische Maschinen und Hochspannungstechnik',address:'Einsteinufer'},
  {code:'ER',name:'Ernst-Ruska-Gebäude',address:'Hardenbergstraße'},
  {code:'EW',name:'Eugene-Paul-Wigner-Gebäude',address:'Hardenbergstraße 36'},
  {code:'F',name:'Gebäude Flugtechnik',address:'Marchstraße 12–14'},
  {code:'FH',name:'Gebäude Fraunhoferstraße',address:'Fraunhoferstraße 33–36'},
  {code:'FR',name:'Fraunhofer-Institute',address:'Fraunhoferstraße'},
  {code:'H',name:'Hauptgebäude',address:'Straße des 17. Juni 135'},
  {code:'HBS',name:'Gebäude Hardenbergstraße',address:'Hardenbergstraße 16–18'},
  {code:'HE',name:'Hörsaalgebäude Elektrotechnik',address:'Straße des 17. Juni 136'},
  {code:'HF',name:'Hermann-Föttinger-Gebäude',address:'Müller-Breslau-Straße 8'},
  {code:'HFT-TA',name:'Hochfrequenztechnik und Technische Akustik',address:'Einsteinufer 25'},
  {code:'HL',name:'Gebäude Heizung und Lüftung',address:'Marchstraße 4'},
  {code:'IMOS',name:'Interdisziplinäres Zentrum für Modellierung und Simulation',address:'Müller-Breslau-Straße'},
  {code:'K',name:'Kraftfahrzeuge',address:'Fasanenstraße'},
  {code:'KF',name:'Kraft- und Fernheizwerk',address:'Fasanenstraße'},
  {code:'KPK',name:'Kraftwerks- und Prozesskomponenten',address:'Hardenbergstraße'},
  {code:'KT',name:'Kerntechnik',address:'Marchstraße'},
  {code:'KWT',name:'Kraftwerkstechnik und Apparatebau',address:'Fasanenstraße'},
  {code:'L',name:'Lebensmittelchemie',address:'Müller-Breslau-Straße'},
  {code:'M',name:'Mechanikgebäude',address:'Straße des 17. Juni'},
  {code:'MA',name:'Mathematikgebäude',address:'Straße des 17. Juni 136'},
  {code:'MAR',name:'Gebäude Marchstraße',address:'Marchstraße 23'},
  {code:'MATH',name:'Mathematik-Neubau',address:'Fasanenstraße 90'},
  {code:'MS',name:'Mechanische Schwingungslehre',address:'Einsteinufer 5'},
  {code:'PC',name:'Physikalische Chemie',address:'Straße des 17. Juni 135'},
  {code:'SE-RH',name:'Reuleaux-Haus und Eisenbahnlehranlage',address:'Straße des 17. Juni 135'},
  {code:'TAP',name:'Technische Akustik Prüfhalle',address:'Einsteinufer 31'},
  {code:'TC',name:'Technische Chemie',address:'Straße des 17. Juni 124'},
  {code:'TEL',name:'Telefunken-Hochhaus',address:'Ernst-Reuter-Platz 7'},
  {code:'TEM',name:'Transelektronenmikroskopie',address:'Marchstraße 10'},
  {code:'TK',name:'Thermodynamik und Kältetechnik',address:'Hardenbergstraße'},
  {code:'V',name:'Verkehrswesen',address:'Straße des 17. Juni 135'},
  {code:'VWS',name:'Versuchsanstalt für Wasserbau und Schiffbau',address:'Müller-Breslau-Straße'},
  {code:'W',name:'Wasserbau und Wasserwirtschaft',address:'Straße des 17. Juni'},
  {code:'Z',name:'Zentralwerkstatt',address:'Fasanenstraße'}
]

const normalize=(value:string)=>value.trim().toLocaleUpperCase('de-DE').replace(/\s+/g,' ')
const roomBuilding=(query:string)=>{
  const value=normalize(query)
  return [...buildings].sort((a,b)=>b.code.length-a.code.length).find(building=>
    value===building.code||value.startsWith(building.code+' ')||value.startsWith(building.code+'-'))
}
const floorHint=(query:string,code:string)=>{
  const room=normalize(query).slice(code.length).match(/\d+/)?.[0]
  if(!room)return ''
  return room[0]==='0'?'wahrscheinlich im Erdgeschoss':`wahrscheinlich im ${room[0]}. Obergeschoss`
}

export default function CampusMap({onBack}:{onBack:()=>void}){
  const [query,setQuery]=useState('')
  const [selected,setSelected]=useState<string|null>(null)
  const detected=roomBuilding(query)
  const value=normalize(query)
  const filtered=!value?buildings:detected
    ?buildings.filter(building=>building.code===detected.code)
    :buildings.filter(building=>normalize(`${building.code} ${building.name} ${building.address}`).includes(value))
  const active=buildings.find(building=>building.code===(selected||detected?.code))
  return <section className="screen secondary-screen campus-page">
    <button className="text-back campus-back" type="button" onClick={onBack}><ArrowLeft size={18}/> Zurück</button>
    <header className="campus-heading"><span className="campus-overline">TU BERLIN · CAMPUS CHARLOTTENBURG</span><h1>Deinen Raum finden.</h1><p>Suche nach Raumcode, Gebäude oder Adresse – zum Beispiel <strong>MA 042</strong>, <strong>H 1012</strong> oder <strong>Bibliothek</strong>.</p></header>
    <label className="campus-search"><Search size={19}/><input autoFocus value={query} onChange={event=>{setQuery(event.target.value);setSelected(null)}} placeholder="Raum oder Gebäude suchen" aria-label="TU-Raum oder Gebäude suchen"/>{query&&<button type="button" onClick={()=>{setQuery('');setSelected(null)}} aria-label="Suche leeren">×</button>}</label>
    {detected&&<div className="campus-room-result" aria-live="polite"><span><MapPin size={18}/></span><div><small>RAUMCODE ERKANNT</small><strong>{normalize(query)}</strong><p>{detected.name} · {detected.address}{floorHint(query,detected.code)?` · ${floorHint(query,detected.code)}`:''}</p></div></div>}
    <div className="campus-map-card">
      <img src="/tu-campus-charlottenburg.png" alt="Übersichtsplan des TU-Campus Charlottenburg mit Gebäudekürzeln"/>
      <div><span><MapPin size={15}/> Zentralcampus Charlottenburg</span><small>Straße des 17. Juni · Ernst-Reuter-Platz · Einsteinufer</small></div>
    </div>
    <div className="campus-content">
      <section className="campus-directory"><div className="campus-section-title"><div><span>GEBÄUDEVERZEICHNIS</span><h2>{filtered.length} {filtered.length===1?'Treffer':'Gebäude'}</h2></div><Building2 size={20}/></div>
        <div className="campus-building-list">{filtered.map(building=><button type="button" className={active?.code===building.code?'active':''} key={building.code} onClick={()=>setSelected(current=>current===building.code?null:building.code)}><b>{building.code}</b><span><strong>{building.name}</strong><small>{building.address}</small></span></button>)}</div>
        {!filtered.length&&<p className="campus-empty">Kein Gebäude gefunden. Prüfe das Kürzel oder öffne den offiziellen TU-Campusplan.</p>}
      </section>
      <aside className="campus-help"><h2>So liest du einen Raumcode</h2><div><b>MA</b><span>Gebäudekürzel – Mathematikgebäude</span></div><div><b>0</b><span>Die erste Ziffer ist häufig das Stockwerk</span></div><div><b>42</b><span>Raumnummer im Gebäude</span></div><p>Die Stockwerksangabe ist eine Orientierung und kann je nach Gebäude abweichen.</p>
        <a href="https://www.tu.berlin/studieren/uni-leben/campusplan" target="_blank" rel="noreferrer">Offiziellen TU-Campusplan öffnen <ExternalLink size={15}/></a>
        <small>Weitere Standorte wie Wedding, Salzufer, Seestraße und Spree-Ufer findest du im offiziellen Plan.</small>
      </aside>
    </div>
  </section>
}
