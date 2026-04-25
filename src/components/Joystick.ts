// Joystick Component for Mobile/Desktop Control

let activeInput = { dx: 0, dy: 0 }
let isDragging = false
let container: HTMLElement | null = null
let knob: HTMLElement | null = null
let baseSize = 120
let knobSize = 50
let maxRadius = (baseSize - knobSize) / 2

export function setupJoystick() {
  if (document.getElementById('joystick-container')) return

  container = document.createElement('div')
  container.id = 'joystick-container'
  container.style.cssText = `
    position: fixed;
    bottom: 40px;
    right: 40px;
    width: ${baseSize}px;
    height: ${baseSize}px;
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 50%;
    touch-action: none;
    z-index: 9999;
    pointer-events: all;
    backdrop-filter: blur(5px);
    display: none;
  `
  
  knob = document.createElement('div')
  knob.id = 'joystick-knob'
  knob.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    width: ${knobSize}px;
    height: ${knobSize}px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    transition: transform 0.1s ease-out;
  `
  container.appendChild(knob)
  
  document.body.appendChild(container)

  // Event Listeners
  const startDrag = (e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    isDragging = true
    if (knob) knob.style.transition = 'none'
    updateKnob(e)
  }

  const moveDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return
    e.preventDefault()
    updateKnob(e)
  }

  const endDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return
    e.preventDefault()
    isDragging = false
    if (knob) knob.style.transition = 'transform 0.1s ease-out'
    activeInput = { dx: 0, dy: 0 }
    if (knob) knob.style.transform = `translate(-50%, -50%)`
  }

  container.addEventListener('mousedown', startDrag)
  window.addEventListener('mousemove', moveDrag)
  window.addEventListener('mouseup', endDrag)

  container.addEventListener('touchstart', startDrag, { passive: false })
  window.addEventListener('touchmove', moveDrag, { passive: false })
  window.addEventListener('touchend', endDrag)
  window.addEventListener('touchcancel', endDrag)
}

function updateKnob(e: MouseEvent | TouchEvent) {
  if (!container || !knob) return
  
  const rect = container.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  let clientX, clientY
  if ('touches' in e) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  } else {
    clientX = (e as MouseEvent).clientX
    clientY = (e as MouseEvent).clientY
  }

  let dx = clientX - centerX
  let dy = clientY - centerY

  const distance = Math.sqrt(dx * dx + dy * dy)
  
  if (distance > maxRadius) {
    const ratio = maxRadius / distance
    dx *= ratio
    dy *= ratio
  }

  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`

  // Normalize input from -1 to 1
  // Invert Y so up is positive
  activeInput = {
    dx: dx / maxRadius,
    dy: -(dy / maxRadius)
  }
}

export function getJoystickInput() {
  return activeInput
}
