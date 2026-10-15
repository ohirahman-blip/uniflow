import { useState } from 'react'
import { ArrowLeft, Building2, ExternalLink, MapPin, Search } from 'lucide-react'
import './campus-map.css'

type CampusBuilding={code:string;name:string;address:string}
type MapBuilding={code:string;x:number;y:number;width:number;depth:number;height:number}

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

const mapBuildings:MapBuilding[]=[
  {code:'MAR',x:76,y:203,width:48,depth:24,height:30},
  {code:'KT',x:142,y:186,width:38,depth:24,height:22},
  {code:'F',x:191,y:222,width:34,depth:21,height:18},
  {code:'TAP',x:152,y:137,width:44,depth:25,height:18},
  {code:'HFT-TA',x:211,y:145,width:54,depth:27,height:28},
  {code:'E-N',x:286,y:130,width:62,depth:31,height:44},
  {code:'E',x:299,y:190,width:78,depth:34,height:27},
  {code:'EMH',x:372,y:165,width:54,depth:28,height:34},
  {code:'MS',x:442,y:137,width:43,depth:24,height:18},
  {code:'BEL',x:219,y:251,width:42,depth:24,height:17},
  {code:'TEM',x:159,y:265,width:44,depth:25,height:20},
  {code:'HE',x:292,y:258,width:57,depth:27,height:24},
  {code:'TC',x:387,y:239,width:62,depth:30,height:42},
  {code:'A-H',x:217,y:335,width:35,depth:28,height:67},
  {code:'A-F',x:271,y:333,width:70,depth:30,height:21},
  {code:'MA',x:358,y:320,width:80,depth:35,height:48},
  {code:'H',x:544,y:279,width:145,depth:49,height:62},
  {code:'C',x:661,y:194,width:88,depth:36,height:35},
  {code:'PC',x:711,y:263,width:49,depth:27,height:30},
  {code:'Z',x:775,y:206,width:37,depth:22,height:32},
  {code:'M',x:786,y:265,width:44,depth:25,height:45},
  {code:'V',x:773,y:325,width:58,depth:28,height:30},
  {code:'TK',x:735,y:390,width:72,depth:29,height:20},
  {code:'BIB',x:866,y:254,width:70,depth:35,height:56},
  {code:'HF',x:850,y:148,width:58,depth:30,height:31},
  {code:'VWS',x:755,y:80,width:139,depth:35,height:25},
  {code:'EB',x:414,y:429,width:57,depth:28,height:23},
  {code:'BH-N',x:444,y:493,width:65,depth:32,height:28},
  {code:'B',x:522,y:457,width:78,depth:35,height:42},
  {code:'BA',x:611,y:453,width:48,depth:27,height:30},
  {code:'KPK',x:655,y:489,width:63,depth:29,height:25},
  {code:'EW',x:728,y:472,width:60,depth:28,height:38}
]

function IsometricBuilding({building,active,onSelect}:{building:MapBuilding;active:boolean;onSelect:()=>void}){
  const {x,y,width,depth,height,code}=building
  const skew=depth*.45
  return <g className={`campus-model-building${active?' active':''}`} role="button" tabIndex={0} aria-label={`Gebäude ${code} auswählen`} onClick={onSelect} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect()}}}>
    <polygon className="campus-model-front" points={`${x},${y-height} ${x+width},${y-height} ${x+width},${y} ${x},${y}`}/>
    <polygon className="campus-model-side" points={`${x+width},${y-height} ${x+width+depth},${y-height-skew} ${x+width+depth},${y-skew} ${x+width},${y}`}/>
    <polygon className="campus-model-roof" points={`${x},${y-height} ${x+width},${y-height} ${x+width+depth},${y-height-skew} ${x+depth},${y-height-skew}`}/>
    <text x={x+width/2+depth/2} y={y-height-skew/2+4} textAnchor="middle">{code}</text>
  </g>
}

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
    <header className="campus-heading"><div><span className="campus-overline">TU BERLIN · CAMPUS CHARLOTTENBURG</span><strong>Campus Navigator</strong></div><p>Raumcode, Gebäude oder Adresse eingeben – zum Beispiel <b>MA 042</b>, <b>H 1012</b> oder <b>Bibliothek</b>.</p></header>
    <label className="campus-search"><Search size={19}/><input autoFocus value={query} onChange={event=>{setQuery(event.target.value);setSelected(null)}} placeholder="Raum oder Gebäude suchen" aria-label="TU-Raum oder Gebäude suchen"/>{query&&<button type="button" onClick={()=>{setQuery('');setSelected(null)}} aria-label="Suche leeren">×</button>}</label>
    {detected&&<div className="campus-room-result" aria-live="polite"><span><MapPin size={18}/></span><div><small>RAUMCODE ERKANNT</small><strong>{normalize(query)}</strong><p>{detected.name} · {detected.address}{floorHint(query,detected.code)?` · ${floorHint(query,detected.code)}`:''}</p></div></div>}
    <div className="campus-map-card">
      <div className="campus-model-head"><span>01 / CAMPUS MODELL</span><small>Gebäude auswählen oder Raum oben suchen</small></div>
      <div className="campus-model-wrap">
        <svg className="campus-isometric-map" viewBox="0 0 1000 580" role="img" aria-labelledby="campus-model-title campus-model-desc">
          <title id="campus-model-title">Isometrisches Modell des TU-Campus Charlottenburg</title>
          <desc id="campus-model-desc">Vereinfachtes dreidimensionales Campusmodell mit anklickbaren Gebäuden.</desc>
          <defs><pattern id="site-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="currentColor" strokeWidth=".55"/></pattern><filter id="building-shadow" x="-20%" y="-20%" width="160%" height="170%"><feDropShadow dx="3" dy="7" stdDeviation="5" floodOpacity=".13"/></filter></defs>
          <rect className="campus-model-ground" x="0" y="0" width="1000" height="580" rx="14"/>
          <rect className="campus-model-grid" x="0" y="0" width="1000" height="580" rx="14"/>
          <path className="campus-model-water" d="M-30 83 C165 33 291 107 463 67 S750 14 1030 69 L1030 116 C788 72 642 115 475 113 S174 78 -30 133Z"/>
          <path className="campus-model-road" d="M505 78 L566 63 L721 580 L644 580Z"/>
          <path className="campus-model-road-line" d="M535 80 L682 580"/>
          <path className="campus-model-road" d="M-20 389 L1010 326 L1010 378 L-20 443Z"/>
          <path className="campus-model-road-line" d="M0 414 L1000 352"/>
          <circle className="campus-model-plaza" cx="342" cy="459" r="49"/>
          <circle className="campus-model-plaza-inner" cx="342" cy="459" r="30"/>
          <g className="campus-model-buildings" filter="url(#building-shadow)">{mapBuildings.map(building=><IsometricBuilding key={building.code} building={building} active={active?.code===building.code} onSelect={()=>setSelected(current=>current===building.code?null:building.code)}/>)}</g>
          <g className="campus-model-north" transform="translate(945 510)"><path d="M0 31 12 0l12 31-12-7Z"/><text x="12" y="45" textAnchor="middle">N</text></g>
          <text className="campus-model-street" x="500" y="397" transform="rotate(-3.5 500 397)">STRASSE DES 17. JUNI</text>
          <text className="campus-model-street" x="776" y="44">LANDWEHRKANAL</text>
        </svg>
        <div className="campus-model-legend"><span><i/> Gebäude</span><span><i/> Auswahl</span><span><i/> Wasser</span></div>
      </div>
      <div className="campus-map-caption"><span><MapPin size={15}/> Zentralcampus Charlottenburg</span><small>Straße des 17. Juni · Ernst-Reuter-Platz · Einsteinufer</small></div>
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
