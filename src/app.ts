// AR Map Base — True 3D Spherical Globe Entry

import * as ecs from '@8thwall/ecs'
import ConicPolygonGeometry from 'three-conic-polygon-geometry'
import * as topojson from 'topojson-client'
import { setupJoystick, getJoystickInput } from './components/Joystick'

// We require the robust TopoJSON to guarantee correct spherical winding orders
const worldTopoJson = require('./data/world-110m.json')
const worldGeoJson = topojson.feature(worldTopoJson, worldTopoJson.objects.countries) as any

const moonTextureSrc = require('./assets/moon.jpg')

// ── Globals ──
let world: any = null
let mapGroup: any = null
let globeGroup: any = null
let oceanMesh: any = null
let ballMesh: any = null
let countriesGroup: any = null
let debugSphere: any = null
let moonMesh: any = null
let initialized = false
let T: any = null

// Solar System Data
const planetsData: any[] = [
  { name: 'Mercury', color: 0xaaaaaa, radius: 0.38, speed: 0.04, instrDist: 25, size: '4,879 km', distEarth: '91 million km', day: '1408 hours (58.7 x Earth)', year: '88 days (0.24 x Earth)', temp: '167°C' },
  { name: 'Venus', color: 0xffdd99, radius: 0.95, speed: 0.015, instrDist: 38, size: '12,104 km', distEarth: '41 million km', day: '5832 hours (243 x Earth)', year: '225 days (0.62 x Earth)', temp: '464°C' },
  { name: 'Mars', color: 0xff4400, radius: 0.53, speed: 0.008, instrDist: 65, size: '6,779 km', distEarth: '78 million km', day: '24.6 hours (1.03 x Earth)', year: '687 days (1.88 x Earth)', temp: '-65°C', moons: [
    {name: 'Phobos', radius: 0.05, dist: 0.8, speed: 0.05}, 
    {name: 'Deimos', radius: 0.04, dist: 1.2, speed: 0.03}
  ]},
  { name: 'Jupiter', color: 0xd2b48c, radius: 4.0, speed: 0.002, instrDist: 90, size: '139,820 km', distEarth: '628 million km', day: '9.9 hours (0.41 x Earth)', year: '12 years (12 x Earth)', temp: '-110°C', moons: [
    {name: 'Io', radius: 0.1, dist: 4.5, speed: 0.04}, 
    {name: 'Europa', radius: 0.09, dist: 5.5, speed: 0.03}, 
    {name: 'Ganymede', radius: 0.12, dist: 6.5, speed: 0.02}, 
    {name: 'Callisto', radius: 0.11, dist: 7.5, speed: 0.01}
  ]},
  { name: 'Saturn', color: 0xf5deb3, radius: 3.5, speed: 0.0009, instrDist: 120, hasRings: true, size: '116,460 km', distEarth: '1.2 billion km', day: '10.7 hours (0.45 x Earth)', year: '29 years (29 x Earth)', temp: '-140°C', moons: [
    {name: 'Titan', radius: 0.15, dist: 5.5, speed: 0.02}
  ]},
  { name: 'Uranus', color: 0xadd8e6, radius: 2.0, speed: 0.0004, instrDist: 155, size: '50,724 km', distEarth: '2.7 billion km', day: '17.2 hours (0.72 x Earth)', year: '84 years (84 x Earth)', temp: '-195°C', moons: [
    {name: 'Titania', radius: 0.08, dist: 3.0, speed: 0.02}
  ]},
  { name: 'Neptune', color: 0x00008b, radius: 1.9, speed: 0.0001, instrDist: 185, size: '49,244 km', distEarth: '4.3 billion km', day: '16.1 hours (0.67 x Earth)', year: '165 years (165 x Earth)', temp: '-200°C', moons: [
    {name: 'Triton', radius: 0.08, dist: 3.0, speed: 0.02}
  ]},
  { name: 'Pluto', color: 0xdddddd, radius: 0.18, speed: 0.00005, instrDist: 215, size: '2,376 km', distEarth: '5.0 billion km', day: '153.3 hours (6.4 x Earth)', year: '248 years (248 x Earth)', temp: '-225°C', moons: [
    {name: 'Charon', radius: 0.09, dist: 0.4, speed: 0.05}
  ]}
]

let solarSystemGroup: any = null
let sunMesh: any = null
let earthLabel: any = null
let selectedPlanet: any = null
let isSolarSystem = false
let capitalMarker: any = null
let kuiperGroup: any = null
let orbitsGroup: any = null
let earthOrbitMeshRef: any = null
let isPolitical = true
let selectedCountryMesh: any = null
let isBallOn = false
let lastBallRaycastTime = 0

let targetFocusLocalPos: any = null
let isAnimatingFocus = false
let targetResetRotationX: number | null = null
let targetGlobeRotationY: number | null = null

function focusOnPlanet(planetMesh: any) {
  if (!T || !mapGroup) return
  if (!targetFocusLocalPos) targetFocusLocalPos = new T.Vector3(0, 0, 0)
  isAnimatingFocus = true
  if (!planetMesh || planetMesh === globeGroup) {
    targetFocusLocalPos.set(0, 0, 0)
  } else {
    const temp = new T.Vector3()
    planetMesh.getWorldPosition(temp)
    mapGroup.worldToLocal(temp)
    if (planetMesh === sunMesh) {
      temp.x += 15 // Offset focus so camera doesn't go inside the sun
    }
    targetFocusLocalPos.copy(temp)
  }
}

function createLabelSprite(text: string, scale: number = 8.0) {
  if (!T) return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 512, 128)
    ctx.font = 'bold 64px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'
    ctx.lineWidth = 8
    ctx.strokeText(text, 256, 64)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, 256, 64)
  }
  const tex = new T.CanvasTexture(canvas)
  const mat = new T.SpriteMaterial({ map: tex, depthTest: false })
  const sprite = new T.Sprite(mat)
  sprite.scale.set(scale, scale * 0.25, 1.0)
  return sprite
}

function getTex(name: string) {
  try {
    switch(name) {
      case 'Sun': return require('./assets/sun.jpg')
      case 'Mercury': return require('./assets/mercury.jpg')
      case 'Venus': return require('./assets/venus.jpg')
      case 'Mars': return require('./assets/mars.jpg')
      case 'Jupiter': return require('./assets/jupiter.jpg')
      case 'Saturn': return require('./assets/saturn.jpg')
      case 'Neptune': return require('./assets/neptune.jpg')
      case 'Pluto': return require('./assets/pluto.jpg')
    }
  } catch(e) {}
  return null
}

// Floating ball state (now using Lat/Lng instead of flat Cartesian!)
const ballState = {
  lat: 45.0,
  lng: -100.0,
}

// ══════════════════════════════════════════
// THREE.JS HELPERS
// ══════════════════════════════════════════

function getThree(): boolean {
  if (T) return true
  T = (window as any).THREE
  if (!T) {
    console.error('[Map Base] THREE not on window')
    return false
  }
  return true
}

// Convert true lat/lng to 3D Cartesian coordinates on a sphere
function geoToSphere(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180)
  // Match three-conic-polygon-geometry theta exactly
  const theta = (90 - lng) * (Math.PI / 180)

  const x = (radius * Math.sin(phi) * Math.cos(theta))
  const y = (radius * Math.cos(phi))
  const z = (radius * Math.sin(phi) * Math.sin(theta))

  return [x, y, z]
}

function showCapitalMarker(lat: number, lng: number) {
  if (!globeGroup || !T) return
  if (!capitalMarker) {
    capitalMarker = new T.Group()
    
    const baseGeom = new T.BoxGeometry(0.015, 0.015, 0.015)
    const baseMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
    const base = new T.Mesh(baseGeom, baseMat)
    base.position.y = 0.0075
    capitalMarker.add(base)
    
    const roofGeom = new T.ConeGeometry(0.014, 0.015, 4)
    const roofMat = new T.MeshStandardMaterial({ color: 0xcc4433, roughness: 0.9 })
    const roof = new T.Mesh(roofGeom, roofMat)
    roof.rotation.y = Math.PI / 4
    roof.position.y = 0.015 + 0.0075
    capitalMarker.add(roof)

    globeGroup.add(capitalMarker)
  }
  
  capitalMarker.visible = true
  
  const altitude = 1.02 // sit firmly on the extruded country
  const [x, y, z] = geoToSphere(lat, lng, altitude)
  capitalMarker.position.set(x, y, z)
  
  const normal = new T.Vector3(x, y, z).normalize()
  capitalMarker.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), normal)
}

// ══════════════════════════════════════════
// MAP GENERATION
// ══════════════════════════════════════════

function buildMap(scene: any) {
  if (!getThree()) return

  mapGroup = new T.Group()
  mapGroup.name = 'MapGroup'
  
  // We use globeGroup so we can rotate the earth without rotating the pivot point
  globeGroup = new T.Group()
  mapGroup.add(globeGroup)

  // Solar System Group
  solarSystemGroup = new T.Group()
  mapGroup.add(solarSystemGroup)
  solarSystemGroup.visible = false

  try {
    const sunTex = getTex('Sun')
    const sunMat = sunTex 
      ? new T.MeshStandardMaterial({ map: new T.TextureLoader().load(sunTex), emissive: 0xffaa00, emissiveIntensity: 0.2 })
      : new T.MeshBasicMaterial({ color: 0xffdd44 })
    
    sunMesh = new T.Mesh(new T.SphereGeometry(10.0, 64, 64), sunMat)
    sunMesh.userData = { isPlanet: true, name: 'Sun' }
    solarSystemGroup.add(sunMesh)
    
    const sunLbl = createLabelSprite('Sun', 20.0)
    if (sunLbl) {
      sunLbl.position.set(0, 13.0, 0)
      sunMesh.add(sunLbl)
    }

    earthLabel = createLabelSprite('Earth', 8.0)
    if (earthLabel) {
      earthLabel.userData = { isEarth: true }
      solarSystemGroup.add(earthLabel)
    }

    orbitsGroup = new T.Group()
    solarSystemGroup.add(orbitsGroup)
    
    const earthOrbitGeom = new T.RingGeometry(50 - 0.3, 50 + 0.3, 128)
    const earthOrbitMat = new T.MeshBasicMaterial({ color: 0x4488ff, side: T.DoubleSide, transparent: true, opacity: 0.25 })
    const earthOrbitMesh = new T.Mesh(earthOrbitGeom, earthOrbitMat)
    earthOrbitMesh.rotation.x = Math.PI / 2
    earthOrbitMeshRef = earthOrbitMesh
    orbitsGroup.add(earthOrbitMesh)

    planetsData.forEach(p => {
      p.pivot = new T.Group()
      solarSystemGroup.add(p.pivot)
      
      const pTex = getTex(p.name)
      const mat = pTex
        ? new T.MeshStandardMaterial({ map: new T.TextureLoader().load(pTex), roughness: 0.5 })
        : new T.MeshStandardMaterial({ color: p.color, roughness: 0.5 })

      p.mesh = new T.Mesh(new T.SphereGeometry(p.radius, 32, 32), mat)
      p.mesh.userData = { isPlanet: true, name: p.name }
      p.pivot.add(p.mesh)
      
      const lbl = createLabelSprite(p.name, p.radius * 3.0 + 5.0)
      if (lbl) {
        lbl.position.set(0, p.radius + 1.5, 0)
        p.mesh.add(lbl)
      }

      // Create glowing orbit track line
      const orbitGeom = new T.RingGeometry(p.instrDist - 0.3, p.instrDist + 0.3, 128)
      const orbitMat = new T.MeshBasicMaterial({ color: p.color, side: T.DoubleSide, transparent: true, opacity: 0.25 })
      const orbitMesh = new T.Mesh(orbitGeom, orbitMat)
      orbitMesh.rotation.x = Math.PI / 2
      p.orbitMesh = orbitMesh
      orbitsGroup.add(orbitMesh)

      if (p.hasRings) {
        const ring = new T.Mesh(
          new T.RingGeometry(p.radius * 1.4, p.radius * 2.2, 32),
          new T.MeshBasicMaterial({ color: p.color, side: T.DoubleSide, transparent: true, opacity: 0.7 })
        )
        ring.rotation.x = Math.PI / 2 - 0.2
        p.mesh.add(ring)
      }

      if (p.moons) {
        p.moonMeshes = p.moons.map((m: any) => {
          const mMesh = new T.Mesh(
            new T.SphereGeometry(m.radius, 16, 16),
            new T.MeshStandardMaterial({ color: 0xcccccc })
          )
          mMesh.userData = { isMoon: true, name: m.name, radius: m.radius }
          p.mesh.add(mMesh)
          return { ...m, mesh: mMesh }
        })
      }
    })

    // Kuiper Belt Haze and Asteroids
    kuiperGroup = new T.Group()
    const hazeGeom = new T.RingGeometry(210, 240, 64)
    const hazeMat = new T.MeshBasicMaterial({ color: 0x555566, side: T.DoubleSide, transparent: true, opacity: 0.15 })
    const hazeMesh = new T.Mesh(hazeGeom, hazeMat)
    hazeMesh.rotation.x = Math.PI / 2
    kuiperGroup.add(hazeMesh)

    // Handful of asteroids
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 210 + Math.random() * 30
      const astSize = 0.05 + Math.random() * 0.1
      const astMat = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 })
      const astMesh = new T.Mesh(new T.SphereGeometry(astSize, 8, 8), astMat)
      astMesh.position.set(Math.cos(angle) * dist, (Math.random() - 0.5) * 2, Math.sin(angle) * dist)
      kuiperGroup.add(astMesh)
    }

    const kuiperLbl = createLabelSprite('Kuiper Belt', 20.0)
    if (kuiperLbl) {
      kuiperLbl.position.set(0, 8.0, 215) // Static position near Pluto
      solarSystemGroup.add(kuiperLbl) // Keep name locked by adding to solarSystemGroup
    }

    solarSystemGroup.add(kuiperGroup)

  } catch(e) { console.error('Solar system creation failed', e) }

  // 1. Beautiful 3D Earth Ocean Sphere (radius 1.0)
  try {
    const oceanGeom = new T.SphereGeometry(1.0, 64, 64)
    const oceanMaterial = new T.MeshStandardMaterial({
      color: 0x0c3d6b, transparent: true, opacity: 0.9,
      metalness: 0.2, roughness: 0.6,
    })
    oceanMesh = new T.Mesh(oceanGeom, oceanMaterial)
    globeGroup.add(oceanMesh)
  } catch (e) { console.error('Ocean creation failed', e) }

  // 2. 3D Extruded Countries via three-conic-polygon-geometry
  countriesGroup = new T.Group()
  globeGroup.add(countriesGroup)

  const material = new T.MeshStandardMaterial({
    color: 0x44aa88, metalness: 0.1, roughness: 0.8,
    side: T.FrontSide // FrontSide prevents raycaster from piercing through to back of globe
  })



  let countryCount = 0
  if (worldGeoJson && worldGeoJson.features) {
    worldGeoJson.features.forEach((feature: any) => {
      try {
        const geomType = feature.geometry?.type
        if (!geomType) return
        const coordinates = feature.geometry.coordinates
        const polygons = geomType === 'Polygon' ? [coordinates] : coordinates

        // Generate a distinct color for political map mode
        const hue = (countryCount * 137.5) % 360
        const saturation = 0.35 + ((countryCount * 0.1) % 0.3)
        const lightness = 0.35 + ((countryCount * 0.15) % 0.3)
        const politicalColor = new T.Color().setHSL(hue / 360, saturation, lightness).getHex()

        const countryGroup = new T.Group()
        countryGroup.userData = {
          country: feature.properties.name,
          clickType: 'countryGroup',
          physicalColor: 0x44aa88,
          politicalColor: politicalColor,
          originalColor: politicalColor,
          isSelected: false
        }

        polygons.forEach((coords: any) => {
          // Increased resolution from 5 to 2 for much more accurate geometry shapes
          const geometry = new ConicPolygonGeometry(coords, 1.0, 1.02, true, true, true, 2)
          const mesh = new T.Mesh(geometry, material.clone())

          // Set initial color to political mode
          mesh.material.color.setHex(politicalColor)
          mesh.userData.parentGroup = countryGroup
          countryGroup.add(mesh)
        })
        
        countriesGroup.add(countryGroup)
        countryCount++
      } catch (e) {
        console.warn(`[Map Base] Country extrusion failed for ${feature.properties?.name}:`, e)
      }
    })
  }
  console.log(`[Map Base] Successfully generated ${countryCount} 3D countries!`)

  // 3. Cute Floating Ball Entity
  try {
    const ballGeom = new T.SphereGeometry(0.03, 32, 32)
    const ballMat = new T.MeshStandardMaterial({
      color: 0xffcc00, roughness: 0.3, metalness: 0.1
    })
    ballMesh = new T.Mesh(ballGeom, ballMat)
    
    updateBallPosition()
    globeGroup.add(ballMesh)
  } catch(e) {}

  // 4. The Moon
  try {
    const moonGeom = new T.SphereGeometry(0.27, 32, 32) // Moon is ~27% Earth's radius
    const moonTexture = new T.TextureLoader().load(moonTextureSrc)
    const moonMat = new T.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.9, metalness: 0.0,
      map: moonTexture
    })
    moonMesh = new T.Mesh(moonGeom, moonMat)
    moonMesh.userData = { isMoon: true, name: 'The Moon', radius: 0.27 }
    globeGroup.add(moonMesh)
  } catch(e) {}

  // Scale the globe to a perfect AR tabletop/room size (radius 0.5m = 1m diameter)
  mapGroup.scale.set(0.5, 0.5, 0.5)
  
  // Apply the 23.5-degree axial tilt and rotate to face the Americas!
  globeGroup.rotation.x = 0
  globeGroup.rotation.y = -Math.PI / 2
  globeGroup.rotation.z = -23.5 * (Math.PI / 180)

  // Pitch the entire map group forward to bring the Northern Hemisphere into view
  mapGroup.rotation.x = -1.4
  
  scene.add(mapGroup)



  // ── Hamburger Menu UI ──
  const menuContainer = document.createElement('div')
  Object.assign(menuContainer.style, {
    position: 'absolute', top: '20px', right: '20px', zIndex: '9999',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px'
  })

  const hamburgerBtn = document.createElement('button')
  hamburgerBtn.innerText = '☰ Options'
  Object.assign(hamburgerBtn.style, {
    padding: '12px 20px', fontSize: '18px', fontWeight: 'bold', fontFamily: 'sans-serif',
    color: '#ffffff', backgroundColor: 'rgba(20, 20, 20, 0.8)',
    backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '30px', cursor: 'pointer', transition: 'all 0.3s ease',
    userSelect: 'none', touchAction: 'manipulation', boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
  })

  const menuOptions = document.createElement('div')
  Object.assign(menuOptions.style, {
    display: 'none', flexDirection: 'column', gap: '10px', alignItems: 'flex-end'
  })

  let isMenuOpen = false
  hamburgerBtn.addEventListener('click', (e) => {
    e.preventDefault()
    isMenuOpen = !isMenuOpen
    menuOptions.style.display = isMenuOpen ? 'flex' : 'none'
  })

  menuContainer.appendChild(hamburgerBtn)
  menuContainer.appendChild(menuOptions)
  document.body.appendChild(menuContainer)

  document.addEventListener('pointerdown', (e: Event) => {
    if (isMenuOpen && menuContainer && !menuContainer.contains(e.target as Node)) {
      isMenuOpen = false
      menuOptions.style.display = 'none'
    }
  })

  // ── UI Overlay for Countries Toggle ──
  const toggleBtn = document.createElement('button')
  toggleBtn.id = 'country-toggle-btn'
  toggleBtn.innerText = '🌍 Countries: ON'
  Object.assign(toggleBtn.style, {
    width: '220px', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold', fontFamily: 'sans-serif',
    color: '#ffffff', backgroundColor: 'rgba(20, 20, 20, 0.6)',
    backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '30px', cursor: 'pointer', transition: 'all 0.3s ease',
    userSelect: 'none', touchAction: 'manipulation'
  })
  menuOptions.appendChild(toggleBtn)

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault()
    isPolitical = !isPolitical
    
    toggleBtn.innerText = isPolitical ? '🌍 Countries: ON' : '🌍 Countries: OFF'
    toggleBtn.style.backgroundColor = isPolitical ? 'rgba(20, 20, 20, 0.6)' : 'rgba(200, 200, 200, 0.6)'
    toggleBtn.style.color = isPolitical ? '#ffffff' : '#000000'

    countriesGroup.children.forEach((group: any) => {
      group.userData.originalColor = isPolitical ? group.userData.politicalColor : group.userData.physicalColor
      if (group.userData.isSelected !== true) {
        group.children.forEach((m: any) => m.material.color.setHex(group.userData.originalColor))
      }
    })
  })

  const solarBtn = document.createElement('button')
  solarBtn.id = 'solar-toggle-btn'
  solarBtn.innerText = '🌌 Solar System: OFF'
  Object.assign(solarBtn.style, {
    width: '220px', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold', fontFamily: 'sans-serif',
    color: '#ffffff', backgroundColor: 'rgba(20, 20, 20, 0.6)',
    backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '30px', cursor: 'pointer', transition: 'all 0.3s ease',
    userSelect: 'none', touchAction: 'manipulation'
  })
  menuOptions.appendChild(solarBtn)

  solarBtn.addEventListener('click', (e) => {
    e.preventDefault()
    isSolarSystem = !isSolarSystem
    solarSystemGroup.visible = isSolarSystem
    solarBtn.innerText = isSolarSystem ? '🌌 Solar System: ON' : '🌌 Solar System: OFF'
    solarBtn.style.backgroundColor = isSolarSystem ? 'rgba(80, 20, 150, 0.8)' : 'rgba(20, 20, 20, 0.6)'
    
    const sliderBox = document.getElementById('orbit-slider-container')
    if (sliderBox) sliderBox.style.display = isSolarSystem ? 'flex' : 'none'

    selectedPlanet = null // Reset selection on toggle

    if (!isSolarSystem) {
      focusOnPlanet(globeGroup) // Smoothly animate back to Earth
      targetResetRotationX = -1.4 // Smoothly animate map pitch back
      globeGroup.rotation.set(0, -Math.PI / 2, -23.5 * (Math.PI / 180)) // Reset tilt
    } else {
      mapGroup.rotation.x = 0 // Keep the solar system plane parallel to the physical floor!
      targetResetRotationX = null
    }
  })

  // ── UI Overlay for Solar System Orbit Slider ──
  const sliderContainer = document.createElement('div')
  sliderContainer.id = 'orbit-slider-container'
  Object.assign(sliderContainer.style, {
    width: '220px', display: 'none', flexDirection: 'column', alignItems: 'center', gap: '8px',
    backgroundColor: 'rgba(20, 20, 20, 0.6)', padding: '15px 20px', borderRadius: '15px',
    backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.2)'
  })
  
  const sliderLabel = document.createElement('label')
  sliderLabel.innerText = 'Rotate Solar System'
  Object.assign(sliderLabel.style, {
    color: '#ffffff', fontSize: '14px', fontWeight: 'bold', fontFamily: 'sans-serif'
  })
  
  const orbitSlider = document.createElement('input')
  orbitSlider.id = 'solar-orbit-slider'
  orbitSlider.type = 'range'
  orbitSlider.min = '0'
  orbitSlider.max = '360'
  orbitSlider.value = '0'
  orbitSlider.style.width = '100%'
  
  sliderContainer.appendChild(sliderLabel)
  sliderContainer.appendChild(orbitSlider)
  menuOptions.appendChild(sliderContainer)

  // ── UI Overlay for Ball Toggle ──
  const ballBtn = document.createElement('button')
  ballBtn.id = 'ball-toggle-btn'
  ballBtn.innerText = '🛰️ Explorer: OFF'
  Object.assign(ballBtn.style, {
    width: '220px', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold', fontFamily: 'sans-serif',
    color: '#000000', backgroundColor: 'rgba(200, 200, 200, 0.6)',
    backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '30px', cursor: 'pointer', transition: 'all 0.3s ease',
    userSelect: 'none', touchAction: 'manipulation'
  })
  menuOptions.appendChild(ballBtn)

  // ── UI Overlay for Reset View Button ──
  const resetBtn = document.createElement('button')
  resetBtn.id = 'reset-btn'
  resetBtn.innerText = '↺ Reset View'
  Object.assign(resetBtn.style, {
    width: '220px', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold', fontFamily: 'sans-serif',
    color: '#ffffff', backgroundColor: 'rgba(200, 50, 50, 0.8)',
    backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '30px', cursor: 'pointer', transition: 'all 0.3s ease',
    userSelect: 'none', touchAction: 'manipulation'
  })
  menuOptions.appendChild(resetBtn)

  resetBtn.addEventListener('click', (e) => {
    e.preventDefault()
    focusOnPlanet(globeGroup)
    selectedPlanet = globeGroup
    if (isSolarSystem) {
      const slider = document.getElementById('solar-orbit-slider') as HTMLInputElement
      if (slider) {
        slider.value = '0'
        solarSystemGroup.rotation.y = 0
      }
    } else {
      targetResetRotationX = -1.4
    }
    globeGroup.rotation.set(0, -Math.PI / 2, -23.5 * (Math.PI / 180))
  })

  if (ballMesh) ballMesh.visible = false
  
  ballBtn.addEventListener('click', (e) => {
    e.preventDefault()
    isBallOn = !isBallOn
    ballBtn.innerText = isBallOn ? '🛰️ Explorer: ON' : '🛰️ Explorer: OFF'
    ballBtn.style.backgroundColor = isBallOn ? 'rgba(20, 20, 20, 0.6)' : 'rgba(200, 200, 200, 0.6)'
    ballBtn.style.color = isBallOn ? '#ffffff' : '#000000'
    
    if (ballMesh) ballMesh.visible = isBallOn
    const joyC = document.getElementById('joystick-container')
    if (joyC) joyC.style.display = isBallOn ? 'flex' : 'none'

    if (isBallOn) {
      // Snap to Explorer (center its longitude)
      targetGlobeRotationY = -Math.PI / 2 - (ballState.lng + 100) * (Math.PI / 180)
    }
  })

  // ── Country Info Popup ──
  const popup = document.createElement('div')
  popup.id = 'country-popup'
  Object.assign(popup.style, {
    position: 'absolute',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    padding: '20px',
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    backdropFilter: 'blur(15px)',
    color: '#ffffff',
    borderRadius: '15px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    minWidth: '250px',
    width: 'max-content',
    maxWidth: '90vw',
    display: 'none',
    fontFamily: 'sans-serif',
    pointerEvents: 'none'
  })
  document.body.appendChild(popup)
}

function showPopup(countryName: string, isPlanet: boolean = false, isMoon: boolean = false, moonRadius: number = 0) {
  if (capitalMarker) capitalMarker.visible = false
  const popup = document.getElementById('country-popup')
  if (!popup) return
  popup.style.display = 'block'
  
  const row = (lbl: string, val: string | number) => `
    <div style="font-size: 14px; margin-bottom: 5px; display: flex; justify-content: space-between; gap: 15px;">
      <strong>${lbl}:</strong> <span style="text-align: right; word-break: break-word;">${val}</span>
    </div>
  `

  if (isMoon) {
    popup.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 18px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">${countryName}</h3>
      ${row('Type', 'Natural Satellite')}
      ${row('Simulated Radius', moonRadius + ' units')}
      <div style="font-size: 14px; color: #aaaaff; margin-top: 8px; text-align: center;">Orbiting Parent Planet</div>
    `
    return
  }

  if (isPlanet) {
    let size = 'Unknown'
    let dist = 'Unknown'
    let day = 'Unknown'
    let year = 'Unknown'
    let temp = 'Unknown'
    let numMoons = 0

    if (countryName === 'Sun') {
      size = '1,392,700 km'
      dist = '149.6 million km'
      day = '27 days'
      temp = '5,500°C'
    } else if (countryName === 'Earth') {
      size = '12,742 km'
      dist = '0 km'
      day = '24 hours'
      year = '365 days'
      temp = '15°C'
      numMoons = 1
    } else {
      const pData = planetsData.find(p => p.name === countryName)
      if (pData) {
        size = pData.size || 'Unknown'
        dist = pData.distEarth || 'Unknown'
        day = pData.day || 'Unknown'
        year = pData.year || 'Unknown'
        temp = pData.temp || 'Unknown'
        numMoons = pData.moons ? pData.moons.length : 0
      }
    }
    
    let popupHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 18px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">${countryName}</h3>
      ${row('Diameter', size)}
      ${row('Distance from Earth', dist)}
      ${row('Length of Day', day)}
    `

    if (countryName !== 'Sun') {
      popupHTML += row('Length of Year', year)
    }

    popupHTML += row('Average Surface Temperature', temp)

    if (countryName !== 'Sun') {
      popupHTML += row('Moons', numMoons)
    }

    popup.innerHTML = popupHTML
    return
  }

  popup.innerHTML = `
    <h3 style="margin: 0 0 10px 0; font-size: 18px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">${countryName}</h3>
    <div style="font-size: 14px; margin-bottom: 5px; color: #ccc;">Fetching data...</div>
  `

  fetch(`https://restcountries.com/v3.1/name/${countryName}?fullText=true`)
    .then(res => res.json())
    .then(data => {
      if (data && data[0]) {
        const d = data[0]
        const pop = d.population ? d.population.toLocaleString() : 'N/A'
        
        let capital = 'N/A'
        if (d.capital && d.capital.length > 0) capital = d.capital[0]
        
        let currency = 'N/A'
        if (d.currencies) {
          const keys = Object.keys(d.currencies)
          if (keys.length > 0) currency = d.currencies[keys[0]].name
        }
        
        let language = 'N/A'
        if (d.languages) {
          const keys = Object.keys(d.languages)
          if (keys.length > 0) language = d.languages[keys[0]]
        }

        const region = d.subregion || d.region || 'N/A'

        if (d.capitalInfo && d.capitalInfo.latlng) {
          showCapitalMarker(d.capitalInfo.latlng[0], d.capitalInfo.latlng[1])
        } else if (d.latlng) {
          showCapitalMarker(d.latlng[0], d.latlng[1])
        }

        const flagImg = d.flags && d.flags.svg ? `<img src="${d.flags.svg}" style="height: 16px; vertical-align: middle; margin-left: 8px; border-radius: 2px;" alt="flag">` : ''

        popup.innerHTML = `
          <h3 style="margin: 0 0 10px 0; font-size: 18px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">${d.name.common} ${flagImg}</h3>
          ${row('Region', region)}
          ${row('Capital', capital)}
          ${row('Population', pop)}
          ${row('Language', language)}
          ${row('Currency', currency)}
        `
      } else {
        throw new Error('Not found')
      }
    })
    .catch(() => {
      popup.innerHTML = `
        <h3 style="margin: 0 0 10px 0; font-size: 18px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">${countryName}</h3>
        <div style="font-size: 14px; color: #ff8888;">Detailed stats unavailable</div>
      `
    })
}

function hidePopup() {
  const popup = document.getElementById('country-popup')
  if (popup) popup.style.display = 'none'
  if (capitalMarker) capitalMarker.visible = false
}

function updateBallPosition() {
  if (!ballMesh) return
  // Sit slightly above the extruded land (globe radius 1.0 + extrusion 0.02 + ball radius 0.03)
  const altitude = 1.05
  const [x, y, z] = geoToSphere(ballState.lat, ballState.lng, altitude)
  ballMesh.position.set(x, y, z)
  
  // Orient the ball so it visually rests correctly on the curvature
  ballMesh.lookAt(0, 0, 0)
}

// ══════════════════════════════════════════
// BEHAVIOR REGISTRATION (ENTRY POINT)
// ══════════════════════════════════════════

ecs.registerBehavior((w: any) => {
  if (initialized) return
  initialized = true
  world = w

  try { buildMap(w.three.scene) } catch (e) { console.error('[Map Base] Map build failed:', e) }
  
  // Safe UI injection
  try { setupJoystick() } catch (e) { console.error('[Map Base] Joystick init failed', e) }

  // Animation Loop
  function animationLoop() {
    try {
      const input = getJoystickInput()
      if (input.dx !== 0 || input.dy !== 0) {
        targetGlobeRotationY = null // User took control
        // Speed in degrees of latitude/longitude per frame
        const speed = 0.5 
        ballState.lng += input.dx * speed
        ballState.lat += input.dy * speed 

        // Clamp latitude strictly to prevent over-the-pole flipping
        ballState.lat = Math.max(-89.99, Math.min(89.99, ballState.lat))

        // Normalize longitude
        while (ballState.lng > 180) ballState.lng -= 360
        while (ballState.lng < -180) ballState.lng += 360

        updateBallPosition()

        // Auto-highlight country under ball
        if (isBallOn && isPolitical && !isSolarSystem && globeGroup) {
          const now = performance.now()
          if (now - lastBallRaycastTime > 150) {
            lastBallRaycastTime = now
            
            const worldOrigin = new T.Vector3()
            globeGroup.getWorldPosition(worldOrigin)
            
            const ballWorld = new T.Vector3()
            ballMesh.getWorldPosition(ballWorld)
            
            const worldDir = new T.Vector3().subVectors(worldOrigin, ballWorld).normalize()
            const raycaster = new T.Raycaster(ballWorld, worldDir)
            
            // Raycast recursively against all children to penetrate groups and hit the actual country meshes
            const intersects = raycaster.intersectObjects(globeGroup.children, true)
            
            let hitCountryGroup = null
            if (intersects.length > 0) {
              for (const hit of intersects) {
                if (hit.object && hit.object.userData && hit.object.userData.parentGroup) {
                  hitCountryGroup = hit.object.userData.parentGroup
                  break
                }
              }
            }

            if (hitCountryGroup) {
              if (selectedCountryMesh !== hitCountryGroup) {
                if (selectedCountryMesh) {
                  selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(selectedCountryMesh.userData.originalColor))
                  selectedCountryMesh.userData.isSelected = false
                }
                selectedCountryMesh = hitCountryGroup
                selectedCountryMesh.userData.isSelected = true
                selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(0xffaa00))
                showPopup(hitCountryGroup.userData.country)
              }
            } else {
              if (selectedCountryMesh) {
                selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(selectedCountryMesh.userData.originalColor))
                selectedCountryMesh.userData.isSelected = false
                selectedCountryMesh = null
                hidePopup()
              }
            }
          }
        }

        if (!isSolarSystem) {
          // Horizontal tracking (Longitude matching - mathematically immune to pitch and gimbal lock)
          const L_front = -90 - (globeGroup.rotation.y + Math.PI/2) * (180 / Math.PI)
          let dLng = ballState.lng - L_front
          while (dLng > 180) dLng -= 360
          while (dLng < -180) dLng += 360

          if (dLng > 45) {
             globeGroup.rotation.y -= (dLng - 45) * (Math.PI / 180) * 0.5
          } else if (dLng < -45) {
             globeGroup.rotation.y -= (dLng + 45) * (Math.PI / 180) * 0.5
          }

          // Vertical tracking (Latitude matching - mathematically immune to camera bugs!)
          // Target_Lat includes a +35 degree offset to perfectly account for your downward AR viewing angle
          const Target_Lat = ballState.lat + 35
          const Front_Lat = -mapGroup.rotation.x * (180 / Math.PI)
          let dLat = Target_Lat - Front_Lat

          if (dLat > 25) {
             mapGroup.rotation.x -= (dLat - 25) * (Math.PI / 180) * 0.5
          } else if (dLat < -25) {
             mapGroup.rotation.x -= (dLat + 25) * (Math.PI / 180) * 0.5
          }
          
          // Lock pitch strictly between looking perfectly at South Pole (+1.5) and North Pole (-1.5)
          // This guarantees the globe NEVER twists or flips!
          mapGroup.rotation.x = Math.max(-1.5, Math.min(1.5, mapGroup.rotation.x))
        }
      }

      // Update Earth/Solar System
      const time = performance.now() * 0.0005

      if (isSolarSystem) {
        const earthDist = 50 // Spread out to accommodate 20.0 radius sun
        const sunX = -earthDist
        
        const sliderInput = document.getElementById('solar-orbit-slider') as HTMLInputElement
        if (sliderInput) {
          const oldRot = solarSystemGroup.rotation.y
          solarSystemGroup.rotation.y = -(parseFloat(sliderInput.value) * Math.PI / 180)
          
          if (oldRot !== solarSystemGroup.rotation.y && selectedPlanet && selectedPlanet !== globeGroup) {
             // Keep camera perfectly locked onto the planet while dragging the slider!
             const temp = new T.Vector3()
             selectedPlanet.getWorldPosition(temp)
             mapGroup.worldToLocal(temp)
             if (selectedPlanet === sunMesh) temp.x += 15
             targetFocusLocalPos.copy(temp)
             
             if (mapGroup.userData.originPos) {
                const targetWorld = mapGroup.localToWorld(targetFocusLocalPos.clone())
                const offset = new T.Vector3().subVectors(mapGroup.userData.originPos, targetWorld)
                mapGroup.position.add(offset) // Snap instantly for tight orbit feel
                isAnimatingFocus = false // We are manually overriding focus
             }
          }
        }

        if (sunMesh) {
          sunMesh.position.set(sunX, 0, 0)
          sunMesh.rotation.y += 0.005
          if (selectedPlanet !== sunMesh) {
             sunMesh.rotation.x += (0 - sunMesh.rotation.x) * 0.05
             sunMesh.rotation.z += (0 - sunMesh.rotation.z) * 0.05
          }
        }
        
        if (orbitsGroup) {
          orbitsGroup.position.set(sunX, 0, 0)
          
          if (earthOrbitMeshRef) {
             // By default (when Earth is effectively selected) its orbit is off
             earthOrbitMeshRef.visible = (selectedPlanet !== null && selectedPlanet !== globeGroup)
          }
          planetsData.forEach(p => { if (p.orbitMesh) p.orbitMesh.visible = true })
          
          if (selectedPlanet === globeGroup && earthOrbitMeshRef) earthOrbitMeshRef.visible = false
          planetsData.forEach(p => {
            if (selectedPlanet === p.mesh && p.orbitMesh) p.orbitMesh.visible = false
          })
        }

        // Earth is static at 0,0,0
        globeGroup.position.set(0, 0, 0)
        // Only snap Earth's rotation back if a different planet is selected
        if (selectedPlanet && selectedPlanet !== globeGroup) {
           globeGroup.rotation.x += (0 - globeGroup.rotation.x) * 0.05
           globeGroup.rotation.z += (-23.5 * (Math.PI / 180) - globeGroup.rotation.z) * 0.05
        }
        if (earthLabel) {
          earthLabel.position.set(0, 2.5, 0)
        }

        planetsData.forEach(p => {
          const distFromSun = p.instrDist
          p.pivot.position.x = sunX + distFromSun
          p.pivot.position.y = 0
          p.pivot.position.z = 0
          p.mesh.rotation.y += p.speed * 0.1 
          if (selectedPlanet !== p.mesh) {
             p.mesh.rotation.x += (0 - p.mesh.rotation.x) * 0.05
             p.mesh.rotation.z += (0 - p.mesh.rotation.z) * 0.05
          }

          if (p.moonMeshes) {
            p.moonMeshes.forEach((m: any) => {
              m.mesh.position.x = Math.cos(time * m.speed) * m.dist
              m.mesh.position.z = Math.sin(time * m.speed) * m.dist
            })
          }
        })

        if (kuiperGroup) {
          kuiperGroup.position.x = sunX
          kuiperGroup.rotation.y -= 0.0005 // Slowly rotate the Kuiper Belt
        }
      }

      if (isAnimatingFocus && mapGroup && mapGroup.userData.originPos) {
         const targetWorld = mapGroup.localToWorld(targetFocusLocalPos.clone())
         const offset = new T.Vector3().subVectors(mapGroup.userData.originPos, targetWorld)
         mapGroup.position.add(offset.multiplyScalar(0.05))
         if (offset.length() < 0.01) isAnimatingFocus = false
      }

      if (targetResetRotationX !== null && mapGroup) {
         mapGroup.rotation.x += (targetResetRotationX - mapGroup.rotation.x) * 0.05
         if (Math.abs(targetResetRotationX - mapGroup.rotation.x) < 0.001) targetResetRotationX = null
      }

      if (targetGlobeRotationY !== null && globeGroup) {
         let diff = targetGlobeRotationY - globeGroup.rotation.y
         while (diff > Math.PI) diff -= Math.PI * 2
         while (diff < -Math.PI) diff += Math.PI * 2
         globeGroup.rotation.y += diff * 0.1
         if (Math.abs(diff) < 0.01) targetGlobeRotationY = null
      }

      // Update Moon Position and Rotation
      if (moonMesh) {
        const orbitRadius = 2.5
        moonMesh.position.x = Math.cos(time * 0.13) * orbitRadius
        moonMesh.position.z = Math.sin(time * 0.13) * orbitRadius
        moonMesh.position.y = Math.sin(time * 0.13) * 0.5
        
        // Tidally locked: The moon always faces the Earth
        moonMesh.lookAt(0, 0, 0)
      }
    } catch (e) { }
    requestAnimationFrame(animationLoop)
  }
  animationLoop()
})

// Camera placement + controls
ecs.registerBehavior((w: any) => {
  if (!mapGroup || !w.three.activeCamera || mapGroup.userData.initializedControls) return
  mapGroup.userData.initializedControls = true

  const cam = w.three.activeCamera

  // Show the map initially so the user can see it while placing
  mapGroup.visible = true
  
  // Create UI overlay for placement instructions
  const placementUI = document.createElement('div')
  Object.assign(placementUI.style, {
    position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px',
    backgroundColor: 'rgba(20,20,20,0.85)', padding: '20px', borderRadius: '15px',
    fontFamily: 'sans-serif', zIndex: '9999', border: '1px solid rgba(255,255,255,0.3)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', transition: 'opacity 0.5s ease'
  })
  
  const instructionTxt = document.createElement('div')
  instructionTxt.innerHTML = '<b style="color:white; font-size:18px;">🌍 Position the Globe</b><br/><span style="color:#aaa; font-size:14px;">Look around, then adjust the height.</span>'
  instructionTxt.style.textAlign = 'center'
  
  const heightSlider = document.createElement('input')
  heightSlider.type = 'range'
  heightSlider.min = '0'
  heightSlider.max = '2'
  heightSlider.step = '0.1'
  heightSlider.value = '1.0'
  heightSlider.style.width = '200px'
  
  const scaleSlider = document.createElement('input')
  scaleSlider.type = 'range'
  scaleSlider.min = '0.2'
  scaleSlider.max = '3.0'
  scaleSlider.step = '0.1'
  scaleSlider.value = '1.0'
  scaleSlider.style.width = '200px'

  const heightWrapper = document.createElement('div')
  heightWrapper.innerHTML = '<span style="color:#aaa; font-size:12px; display:block; text-align:center;">Height Offset</span>'
  heightWrapper.appendChild(heightSlider)

  const scaleWrapper = document.createElement('div')
  scaleWrapper.innerHTML = '<span style="color:#aaa; font-size:12px; display:block; text-align:center;">Globe Scale</span>'
  scaleWrapper.appendChild(scaleSlider)
  
  const placeBtn = document.createElement('button')
  placeBtn.innerText = '✅ PLACE GLOBE'
  Object.assign(placeBtn.style, {
    padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', color: 'white',
    backgroundColor: '#4CAF50', border: 'none', borderRadius: '8px', cursor: 'pointer'
  })

  placementUI.appendChild(instructionTxt)
  placementUI.appendChild(heightWrapper)
  placementUI.appendChild(scaleWrapper)
  placementUI.appendChild(placeBtn)
  
  // Hide UI initially while AR camera loads
  placementUI.style.display = 'none'
  document.body.appendChild(placementUI)

  let isPlaced = false
  let surfaceFound = false
  
  // AR Surface Reticle
  const reticleGeom = new T.RingGeometry(0.4, 0.5, 32)
  const reticleMat = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: true, opacity: 0.8 })
  const reticle = new T.Mesh(reticleGeom, reticleMat)
  w.three.scene.add(reticle)
  
  // Center line pointing up from reticle
  const lineGeom = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, 2.0, 0)])
  const lineMat = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
  const reticleLine = new T.Line(lineGeom, lineMat)
  reticle.add(reticleLine)

  const isDesktop = !(/Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) && navigator.maxTouchPoints <= 1
  if (isDesktop) {
    isPlaced = true
    placementUI.style.display = 'none'
    const dir = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    mapGroup.position.copy(cam.position).add(dir.multiplyScalar(1.5))
    mapGroup.userData.originPos = mapGroup.position.clone()
  }

  // Animation loop to perform hit test and place reticle + mapGroup
  const updatePlacement = () => {
    if (isPlaced) {
      reticle.visible = false
      return
    }
    
    let hitSuccess = false
    
    // Attempt 8th Wall Hit Test at center of screen (0.5, 0.5)
    if ((window as any).XR8 && (window as any).XR8.XrController) {
      try {
        const HitTypes = (window as any).XR8.XrController.HitTestTypes || {}
        const types = [HitTypes.FEATURE_POINT || 'FEATURE_POINT', HitTypes.ESTIMATED_SURFACE || 'ESTIMATED_SURFACE']
        const hitRes = (window as any).XR8.XrController.hitTest(0.5, 0.5, types)
        if (hitRes && hitRes.length > 0) {
          const hit = hitRes[0]
          const targetPos = new T.Vector3(hit.position.x, hit.position.y, hit.position.z)
          
          // Smoothly interpolate towards the physical hit test
          reticle.position.lerp(targetPos, 0.1)
          reticle.rotation.set(-Math.PI / 2, 0, 0) // FORCE FLAT
          hitSuccess = true
        }
      } catch (e) {}
    }

    if (!hitSuccess) {
      // Fallback: Stick it 1.5m in front of the camera, 1m down
      const dir = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
      const targetPos = cam.position.clone().add(dir.multiplyScalar(1.5))
      targetPos.y -= 1.0 // Estimate floor is 1m below phone
      
      reticle.position.lerp(targetPos, 0.1)
      reticle.rotation.set(-Math.PI / 2, 0, 0)
    }

    // Always keep reticle visible during placement!
    reticle.visible = true

    // Show the placement UI now that AR is definitely ticking
    if (!isDesktop && placementUI.style.display === 'none') {
       placementUI.style.display = 'flex'
       const loader = document.getElementById('camera-loading-ui')
       if (loader) loader.style.display = 'none'
    }

    // Always place the map directly above the reticle based on the height slider
    const heightOffset = parseFloat(heightSlider.value)
    mapGroup.position.copy(reticle.position)
    mapGroup.position.y += heightOffset
    
    // Scale globe based on slider
    const scaleMult = parseFloat(scaleSlider.value)
    mapGroup.scale.set(0.2 * scaleMult, 0.2 * scaleMult, 0.2 * scaleMult)
    mapGroup.position.y += heightOffset
    
    requestAnimationFrame(updatePlacement)
  }
  updatePlacement()

  placeBtn.addEventListener('click', (e) => {
    e.preventDefault()
    isPlaced = true
    placementUI.style.opacity = '0'
    setTimeout(() => placementUI.remove(), 500)
    mapGroup.userData.originPos = mapGroup.position.clone()
  })

  // ── MOUSE CONTROLS ──
  let isSpinning = false
  let isPanning = false
  let previousX = 0
  let previousY = 0
  let pointerDownX = 0
  let pointerDownY = 0

  const isUI = (e: PointerEvent | TouchEvent) => {
    const target = e.target as HTMLElement
    return target.closest('#joystick-container') !== null || 
           target.closest('#country-toggle-btn') !== null ||
           target.closest('#solar-toggle-btn') !== null
  }

  const downListener = (e: PointerEvent) => {
    if (isUI(e)) return
    if (!isPlaced) return // Prevent drag interaction while placing

    targetGlobeRotationY = null
    if (e.pointerType === 'touch') return
    if (e.button === 0) isSpinning = true
    else if (e.button === 2) isPanning = true
    previousX = e.clientX
    previousY = e.clientY
    pointerDownX = e.clientX
    pointerDownY = e.clientY
  }
  const moveListener = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    const dx = e.clientX - previousX
    const dy = e.clientY - previousY

    if (isSpinning) {
      const targetToSpin = (isSolarSystem && selectedPlanet && selectedPlanet !== globeGroup) ? selectedPlanet : globeGroup
      
      if (!isSolarSystem && targetToSpin === globeGroup) {
        // Normal Globe Mode: Preserve Earth's geographic tilt
        targetToSpin.rotateY(dx * 0.005)
        const rightAxis = new T.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
        mapGroup.rotateOnWorldAxis(rightAxis, -dy * 0.005)
      } else {
        // Solar System Mode: Free trackball for ALL planets (including Earth!)
        const rightAxis = new T.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
        const upAxis = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
        targetToSpin.rotateOnWorldAxis(upAxis, dx * 0.005)
        targetToSpin.rotateOnWorldAxis(rightAxis, -dy * 0.005)
      }
    } else if (isPanning) {
      // Right Click translates the globe
      const right = new T.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
      const up = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)

      const panMultiplier = isSolarSystem ? 2.0 : 1.0
      const panSpeed = 0.004 * mapGroup.scale.x * panMultiplier
      mapGroup.position.add(right.multiplyScalar(-dx * panSpeed))
      mapGroup.position.add(up.multiplyScalar(-dy * panSpeed))

      // Clamp distance
      const dist = mapGroup.position.distanceTo(mapGroup.userData.originPos)
      const maxDistance = isSolarSystem ? 200.0 : 2.0 // meters
      if (dist > maxDistance) {
        const clampDir = new T.Vector3().subVectors(mapGroup.position, mapGroup.userData.originPos).normalize()
        mapGroup.position.copy(mapGroup.userData.originPos).add(clampDir.multiplyScalar(maxDistance))
      }
    }
    previousX = e.clientX
    previousY = e.clientY
  }
  const upListener = (e: PointerEvent) => {
    if (isUI(e)) return
    if (e.button === 0) isSpinning = false
    if (e.button === 2) isPanning = false

    // Handle Mouse Selection (Desktop)
    if (e.pointerType !== 'touch' && Math.abs(e.clientX - pointerDownX) < 5 && Math.abs(e.clientY - pointerDownY) < 5) {
      const raycaster = new T.Raycaster()
      const currentCam = w.three.camera || w.three.activeCamera || (window as any).XR8.Threejs.xrCamera()
      const nx = (pointerDownX / window.innerWidth) * 2 - 1
      const ny = -(pointerDownY / window.innerHeight) * 2 + 1
      raycaster.setFromCamera(new T.Vector2(nx, ny), currentCam)

      let objectsToIntersect = globeGroup.children
      if (isSolarSystem && solarSystemGroup) {
        objectsToIntersect = [...globeGroup.children, ...solarSystemGroup.children.filter((c: any) => c !== kuiperGroup)]
      }
      const intersects = raycaster.intersectObjects(objectsToIntersect, true)
      
      if (intersects.length > 0) {
        const firstHit = intersects[0].object
        
        if (isSolarSystem) {
          let hitPlanet = null
          let hitMoon = null
          let isEarth = false
          let current = firstHit
          while (current) {
            if (current.userData && current.userData.isMoon) {
              hitMoon = current
            }
            if (current.userData && current.userData.isPlanet) {
              hitPlanet = current
              break
            }
            if (current === globeGroup || (current.userData && current.userData.isEarth)) {
              isEarth = true
              break
            }
            current = current.parent
          }

          if (hitPlanet) {
            selectedPlanet = hitPlanet
            focusOnPlanet(hitPlanet)
            if (hitMoon) {
              showPopup(hitMoon.userData.name, false, true, hitMoon.userData.radius)
            } else {
              showPopup(hitPlanet.userData.name, true)
            }
          } else if (isEarth) {
            selectedPlanet = globeGroup
            focusOnPlanet(globeGroup)
            if (hitMoon) {
              showPopup(hitMoon.userData.name, false, true, hitMoon.userData.radius)
            } else {
              showPopup('Earth', true)
            }
          } else {
            hidePopup()
          }
        } else {
          if (firstHit.userData && firstHit.userData.isPlanet) {
            selectedPlanet = firstHit
            showPopup(firstHit.userData.name, true)
          } else if (firstHit.userData && firstHit.userData.parentGroup) {
            selectedPlanet = null // clear planet selection
            const countryGroup = firstHit.userData.parentGroup
            if (selectedCountryMesh) {
              selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(selectedCountryMesh.userData.originalColor))
              selectedCountryMesh.userData.isSelected = false
            }
            selectedCountryMesh = countryGroup
            selectedCountryMesh.userData.isSelected = true
            selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(0xffaa00)) // Highlight all parts
            showPopup(countryGroup.userData.country)
          } else {
            // Hit ocean or ball
            if (selectedCountryMesh) {
              selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(selectedCountryMesh.userData.originalColor))
              selectedCountryMesh.userData.isSelected = false
              selectedCountryMesh = null
            }
            hidePopup()
          }
        }
      } else {
        // Hit empty space
        if (!isSolarSystem) {
          selectedPlanet = null
        }
        if (selectedCountryMesh) {
          selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(selectedCountryMesh.userData.originalColor))
          selectedCountryMesh.userData.isSelected = false
          selectedCountryMesh = null
        }
        hidePopup()
      }
    }
  }

  const applyZoomAtScreenPoint = (newScale: number, pointerX: number, pointerY: number) => {
    const oldScale = mapGroup.scale.x
    if (oldScale === newScale) return

    const raycaster = new T.Raycaster()
    const currentCam = w.three.camera || w.three.activeCamera || (window as any).XR8.Threejs.xrCamera()
    const canvas = w.three.renderer.domElement
    const nx = (pointerX / canvas.clientWidth) * 2 - 1
    const ny = -(pointerY / canvas.clientHeight) * 2 + 1
    raycaster.setFromCamera(new T.Vector2(nx, ny), currentCam)

    const normal = new T.Vector3(0, 0, 1).applyQuaternion(currentCam.quaternion).normalize()
    const plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, mapGroup.position)
    const hitWorld = new T.Vector3()
    raycaster.ray.intersectPlane(plane, hitWorld)

    if (hitWorld.lengthSq() === 0) {
      mapGroup.scale.set(newScale, newScale, newScale)
      return
    }

    const hitLocal = mapGroup.worldToLocal(hitWorld.clone())
    mapGroup.scale.set(newScale, newScale, newScale)
    mapGroup.updateMatrixWorld(true)
    const newHitWorld = mapGroup.localToWorld(hitLocal.clone())

    mapGroup.position.add(hitWorld.sub(newHitWorld))
  }

  const wheelListener = (e: WheelEvent) => {
    if (isUI(e as any)) return
    let s = mapGroup.scale.x - e.deltaY * 0.001
    s = Math.max(0.2, Math.min(s, 5.0))
    applyZoomAtScreenPoint(s, e.clientX, e.clientY)
  }

  window.addEventListener('contextmenu', e => e.preventDefault())
  window.addEventListener('pointerdown', downListener)
  window.addEventListener('pointermove', moveListener)
  window.addEventListener('pointerup', upListener)
  window.addEventListener('pointerleave', upListener)
  window.addEventListener('wheel', wheelListener, { passive: false })

  // ── TOUCH CONTROLS ──
  let touchStartDist = 0
  let touchStartScale = 1
  let lastTouchX = 0
  let lastTouchY = 0
  let touchDownX = 0
  let touchDownY = 0
  let lastAvgX = 0
  let lastAvgY = 0
  let touchCount = 0
  let lastTouchAngle = 0

  window.addEventListener('touchstart', (e: TouchEvent) => {
    if (isUI(e as any)) return
    if (!isPlaced) return // Prevent drag interaction while placing
      
    targetGlobeRotationY = null
    touchCount = e.touches.length
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchStartDist = Math.sqrt(dx * dx + dy * dy)
      touchStartScale = mapGroup.scale.x
      lastAvgX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      lastAvgY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      lastTouchAngle = Math.atan2(dy, dx)
    } else if (e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX
      lastTouchY = e.touches[0].clientY
      touchDownX = e.touches[0].clientX
      touchDownY = e.touches[0].clientY
    }
  }, { passive: true })

  window.addEventListener('touchmove', (e: TouchEvent) => {
    if (isUI(e as any)) return
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const currentAngle = Math.atan2(dy, dx)
      
      if (touchStartDist > 0) {
        let s = touchStartScale * (dist / touchStartDist)
        s = Math.max(0.2, Math.min(s, 5.0))
        applyZoomAtScreenPoint(s, (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2)
      }

      // Handle Twist (Roll)
      if (lastTouchAngle !== undefined) {
        let angleDiff = currentAngle - lastTouchAngle
        // Fix wrap-around when crossing PI / -PI
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2

        const forwardAxis = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
        mapGroup.rotateOnWorldAxis(forwardAxis, -angleDiff)
        
        lastTouchAngle = currentAngle
      }

      if (lastAvgX > 0 && lastAvgY > 0) {
        const avgX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const dX = avgX - lastAvgX
        const dY = avgY - lastAvgY

        // 2-finger drag to pan (translate) the globe in space
        const right = new T.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
        const up = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)

        // scaled loosely by map scale to feel right
        const panMultiplier = isSolarSystem ? 2.0 : 1.0
        const panSpeed = 0.004 * mapGroup.scale.x * panMultiplier
        mapGroup.position.add(right.multiplyScalar(-dX * panSpeed))
        mapGroup.position.add(up.multiplyScalar(-dY * panSpeed))

        // Clamp distance
        const dist = mapGroup.position.distanceTo(mapGroup.userData.originPos)
        const maxDistance = isSolarSystem ? 200.0 : 2.0 // meters
        if (dist > maxDistance) {
          const clampDir = new T.Vector3().subVectors(mapGroup.position, mapGroup.userData.originPos).normalize()
          mapGroup.position.copy(mapGroup.userData.originPos).add(clampDir.multiplyScalar(maxDistance))
        }

        lastAvgX = avgX
        lastAvgY = avgY
      } else {
        lastAvgX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        lastAvgY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      }
    } else if (e.touches.length === 1 && touchCount === 1) {
      // 1-finger touch pans (which is now rotating the globe!)
      const dx = e.touches[0].clientX - lastTouchX
      const dy = e.touches[0].clientY - lastTouchY
      
      const targetToSpin = (isSolarSystem && selectedPlanet && selectedPlanet !== globeGroup) ? selectedPlanet : globeGroup
      
      if (!isSolarSystem && targetToSpin === globeGroup) {
        targetToSpin.rotateY(dx * 0.005)
        const rightAxis = new T.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
        mapGroup.rotateOnWorldAxis(rightAxis, -dy * 0.005)
      } else {
        const rightAxis = new T.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
        const upAxis = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
        targetToSpin.rotateOnWorldAxis(upAxis, dx * 0.005)
        targetToSpin.rotateOnWorldAxis(rightAxis, -dy * 0.005)
      }

      lastTouchX = e.touches[0].clientX
      lastTouchY = e.touches[0].clientY
    }
  }, { passive: true })

  window.addEventListener('touchend', (e: TouchEvent) => {
    if (isUI(e as any)) return

    // Handle Touch Selection
    if (touchCount === 1 && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0]
      if (Math.abs(touch.clientX - touchDownX) < 25 && Math.abs(touch.clientY - touchDownY) < 25) {
        const raycaster = new T.Raycaster()
        
        // Fix Biological Thumb-Roll Offset:
        const nx = (touchDownX / window.innerWidth) * 2 - 1
        const ny = -(touchDownY / window.innerHeight) * 2 + 1
        const currentCam = w.three.camera || w.three.activeCamera || (window as any).XR8.Threejs.xrCamera()
        raycaster.setFromCamera(new T.Vector2(nx, ny), currentCam)

        let objectsToIntersect = globeGroup.children
        if (isSolarSystem && solarSystemGroup) {
          objectsToIntersect = [...globeGroup.children, ...solarSystemGroup.children.filter((c: any) => c !== kuiperGroup)]
        }
        const intersects = raycaster.intersectObjects(objectsToIntersect, true)
        
        if (intersects.length > 0) {
          const firstHit = intersects[0].object
          
          if (isSolarSystem) {
            let hitPlanet = null
            let hitMoon = null
            let isEarth = false
            let current = firstHit
            while (current) {
              if (current.userData && current.userData.isMoon) {
                hitMoon = current
              }
              if (current.userData && current.userData.isPlanet) {
                hitPlanet = current
                break
              }
              if (current === globeGroup || (current.userData && current.userData.isEarth)) {
                isEarth = true
                break
              }
              current = current.parent
            }

            if (hitPlanet) {
              selectedPlanet = hitPlanet
              focusOnPlanet(hitPlanet)
              if (hitMoon) {
                showPopup(hitMoon.userData.name, false, true, hitMoon.userData.radius)
              } else {
                showPopup(hitPlanet.userData.name, true)
              }
            } else if (isEarth) {
              selectedPlanet = globeGroup
              focusOnPlanet(globeGroup)
              if (hitMoon) {
                showPopup(hitMoon.userData.name, false, true, hitMoon.userData.radius)
              } else {
                showPopup('Earth', true)
              }
            } else {
              hidePopup()
            }
          } else {
            if (firstHit.userData && firstHit.userData.isPlanet) {
              selectedPlanet = firstHit
              showPopup(firstHit.userData.name, true)
            } else if (firstHit.userData && firstHit.userData.parentGroup) {
              selectedPlanet = null
              const countryGroup = firstHit.userData.parentGroup
              if (selectedCountryMesh) {
                selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(selectedCountryMesh.userData.originalColor))
                selectedCountryMesh.userData.isSelected = false
              }
              selectedCountryMesh = countryGroup
              selectedCountryMesh.userData.isSelected = true
              selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(0xffaa00))
              showPopup(countryGroup.userData.country)
            } else {
              if (selectedCountryMesh) {
                selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(selectedCountryMesh.userData.originalColor))
                selectedCountryMesh.userData.isSelected = false
                selectedCountryMesh = null
              }
              hidePopup()
            }
          }
        } else {
          if (!isSolarSystem) {
            selectedPlanet = null
          }
          if (selectedCountryMesh) {
            selectedCountryMesh.children.forEach((m: any) => m.material.color.setHex(selectedCountryMesh.userData.originalColor))
            selectedCountryMesh.userData.isSelected = false
            selectedCountryMesh = null
          }
          hidePopup()
        }
      }
    }

    touchCount = e.touches.length
    if (touchCount === 1) {
      lastTouchX = e.touches[0].clientX
      lastTouchY = e.touches[0].clientY
    }
    if (touchCount < 2) touchStartDist = 0
  }, { passive: true })
})
