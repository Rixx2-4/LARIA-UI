import { configure } from "@testing-library/react"

// Los findBy esperan 1 s por defecto: poco cuando la suite entera corre en paralelo
configure({ asyncUtilTimeout: 5000 })

// jsdom no implementa el scroll de elementos
Element.prototype.scrollTo = function () {}

// jsdom no implementa matchMedia (lo usan el tema del sistema y el movimiento reducido)
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }) as MediaQueryList

// jsdom no implementa IntersectionObserver (lo usan las animaciones al hacer scroll):
// aquí todo se da por visible nada más observarlo
class VisibleIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target, intersectionRatio: 1 } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
window.IntersectionObserver ??= VisibleIntersectionObserver as unknown as typeof IntersectionObserver
