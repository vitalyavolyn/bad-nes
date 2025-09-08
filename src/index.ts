/* eslint-disable */
import { NES } from "./nes.js"

console.log('hello')
const nes = new NES();
let isStarted = false;

const fileSelector = document.getElementById('rom');
fileSelector!.addEventListener('change', (event: any) => {
  const file = event.target.files[0];

  if (isStarted || !file) {
    console.log('fuck you');
    return;
  }

  const reader = new FileReader()

  reader.onerror = () => {
    alert('Something unbelievable happened. Reload.')
  }

  reader.onload = () => {
    nes.loadROM(reader.result as ArrayBuffer)
    nes.start()
    isStarted = true
  }
  
  reader.readAsArrayBuffer(file);
})

//@ts-expect-error: debug
window.nes = nes