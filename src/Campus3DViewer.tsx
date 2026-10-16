import { useEffect, useRef, useState } from 'react'
import type { Material, Object3D, Texture } from 'three'

type Campus3DViewerProps={activeCode?:string;activeName?:string}
type CampusTile={file:string;x:number;south:number}

const tiles:CampusTile[]=[
  {file:'5a45ed14-4596-4b00-a9a4-11c39b850352.glb',x:25.27,south:57.17},
  {file:'78d11849-8e8b-4ade-8508-d72f65253cfd.glb',x:205.27,south:-78.89},
  {file:'50cd1f7a-7371-4d98-adff-c60954e93f8c.glb',x:191.25,south:409.17},
  {file:'44ec1155-6996-4b49-b0e6-da55453b68b7.glb',x:292.26,south:224.14},
  {file:'033866fe-8ac2-4757-9d30-9043e100042f.glb',x:420.24,south:-258.92},
  {file:'15a8accd-169d-46a2-8227-b8a87ddf1bad.glb',x:494.28,south:-78.91},
  {file:'88fddc58-a7e0-4048-86b3-4475b9dacfc9.glb',x:627.27,south:-150.83}
]

const disposeObject=(object:Object3D)=>object.traverse(child=>{
  const mesh=child as Object3D&{geometry?:{dispose:()=>void};material?:Material|Material[]}
  mesh.geometry?.dispose()
  const materials=Array.isArray(mesh.material)?mesh.material:mesh.material?[mesh.material]:[]
  materials.forEach(material=>{
    Object.values(material).forEach(value=>{if(value&&typeof value==='object'&&'isTexture' in value)(value as Texture).dispose()})
    material.dispose()
  })
})

export default function Campus3DViewer({activeCode,activeName}:Campus3DViewerProps){
  const mountRef=useRef<HTMLDivElement>(null)
  const [progress,setProgress]=useState(0)
  const [failed,setFailed]=useState(false)

  useEffect(()=>{
    const mount=mountRef.current
    if(!mount)return
    let disposed=false
    let frame=0
    let observer:ResizeObserver|undefined
    let cleanup=()=>{}

    Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/loaders/DRACOLoader.js'),
      import('three/addons/controls/OrbitControls.js')
    ]).then(async([T,{GLTFLoader},{DRACOLoader},{OrbitControls}])=>{
      if(disposed)return
      const scene=new T.Scene()
      scene.background=new T.Color(0xc8c6bf)
      scene.fog=new T.Fog(0xc8c6bf,1080,1750)
      const camera=new T.PerspectiveCamera(34,1,1,2500)
      camera.position.set(430,390,520)
      const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75))
      renderer.outputColorSpace=T.SRGBColorSpace
      renderer.toneMapping=T.ACESFilmicToneMapping
      renderer.toneMappingExposure=.92
      renderer.shadowMap.enabled=true
      renderer.shadowMap.type=T.PCFShadowMap
      mount.appendChild(renderer.domElement)

      scene.add(new T.HemisphereLight(0xfff6df,0x46505a,1.45))
      const sun=new T.DirectionalLight(0xffe9bb,3.1)
      sun.position.set(-340,620,230)
      sun.castShadow=true
      sun.shadow.mapSize.set(2048,2048)
      sun.shadow.camera.left=-620;sun.shadow.camera.right=620;sun.shadow.camera.top=620;sun.shadow.camera.bottom=-620
      scene.add(sun)
      const base=new T.Mesh(new T.PlaneGeometry(1700,1500),new T.MeshStandardMaterial({color:0xd9d6cd,roughness:1}))
      base.rotation.x=-Math.PI/2
      base.position.y=-5.15
      base.receiveShadow=true
      scene.add(base)

      const controls=new OrbitControls(camera,renderer.domElement)
      controls.target.set(0,18,0)
      controls.enableDamping=true
      controls.dampingFactor=.06
      controls.minDistance=210
      controls.maxDistance=1250
      controls.maxPolarAngle=Math.PI*.47
      controls.update()

      const manager=new T.LoadingManager()
      manager.onProgress=(_,loaded,total)=>{if(!disposed)setProgress(Math.round(loaded/total*100))}
      const draco=new DRACOLoader(manager)
      // Keep the decoder with the app. Relying on DRACOLoader's empty default
      // path leaves compressed campus tiles waiting for decoder files at `/`.
      draco.setDecoderPath('/draco/')
      draco.setDecoderConfig({type:'wasm'})
      const loader=new GLTFLoader(manager)
      loader.setDRACOLoader(draco)
      const loaded:Object3D[]=[]
      const resize=()=>{
        const {width}=mount.getBoundingClientRect()
        const clientWidth=mount.clientWidth
        const height=Math.max(420,Math.min(650,width*.59))
        renderer.setSize(clientWidth,height,false)
        camera.aspect=clientWidth/height
        camera.updateProjectionMatrix()
      }
      observer=new ResizeObserver(resize)
      observer.observe(mount)
      resize()
      const render=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render)}
      render()
      cleanup=()=>{
        cancelAnimationFrame(frame)
        observer?.disconnect()
        controls.dispose()
        draco.dispose()
        loaded.forEach(disposeObject)
        base.geometry.dispose()
        ;(base.material as Material).dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }

      try{
        const models=await Promise.all(tiles.map(tile=>loader.loadAsync(`/campus-3d/${tile.file}`)))
        if(disposed){models.forEach(model=>disposeObject(model.scene));return}
        models.forEach((model,index)=>{
          const tile=tiles[index]
          model.scene.rotation.x=-Math.PI/2
          model.scene.position.set(tile.x-491,0,225-tile.south)
          model.scene.traverse(child=>{
            const mesh=child as Object3D&{isMesh?:boolean;castShadow?:boolean;receiveShadow?:boolean;material?:Material|Material[]}
            if(mesh.isMesh){
              mesh.castShadow=true;mesh.receiveShadow=true
              const materials=Array.isArray(mesh.material)?mesh.material:mesh.material?[mesh.material]:[]
              materials.forEach(material=>{
                const surface=material as Material&{name:string;color?:{set:(value:number)=>void};roughness?:number;metalness?:number}
                if(surface.name==='buildings_material'){
                  surface.color?.set(0xd5d0c5)
                  surface.roughness=.84
                  surface.metalness=.02
                }
              })
            }
          })
          loaded.push(model.scene)
          scene.add(model.scene)
        })
        setProgress(100)
      }catch(error){
        console.error('Campus 3D model failed to load',error)
        if(!disposed)setFailed(true)
      }
    }).catch(error=>{console.error('Campus 3D viewer failed to initialize',error);if(!disposed)setFailed(true)})

    return()=>{disposed=true;cleanup()}
  },[])

  return <div className="campus-3d-shell">
    <div ref={mountRef} className="campus-3d-stage" role="img" aria-label="Interaktives dreidimensionales Modell des TU-Campus Charlottenburg"/>
    {progress<100&&!failed?<div className="campus-3d-loading"><span style={{width:`${progress}%`}}/><b>Campus wird aufgebaut · {progress}%</b></div>:null}
    {failed?<div className="campus-3d-error">Das 3D-Modell konnte nicht geladen werden.</div>:null}
    <div className="campus-3d-controls"><span>DRAG</span> drehen <span>SCROLL</span> zoomen</div>
    {activeCode?<div className="campus-3d-active"><b>{activeCode}</b><span>{activeName}</span></div>:null}
  </div>
}
