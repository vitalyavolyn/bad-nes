export function word(lo: number, hi: number) {
  return ((hi & 0xFF) << 8) | (lo & 0xFF)
}

export function hi(word: number) {
  return word >> 8
}

export function lo(word: number) {
  return word & 0xff
}

export function uint8ToInt8(val: number): number {
  const negative = val & 0x80
  return negative ? val - 0x100 : val & 0xFF
}

export function decByte(val: number): number {
  return (val - 1) & 0xff
}

export function incByte(val: number): number {
  return (val + 1) & 0xff
}
