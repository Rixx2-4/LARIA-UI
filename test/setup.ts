import { configure } from "@testing-library/react"

// Los findBy esperan 1 s por defecto: poco cuando la suite entera corre en paralelo
configure({ asyncUtilTimeout: 5000 })

// jsdom no implementa el scroll de elementos
Element.prototype.scrollTo = function () {}
