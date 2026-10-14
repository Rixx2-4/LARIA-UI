"use client"

import dynamic from "next/dynamic"

// Los componentes de Clerk que usan las páginas salen del MISMO fragmento de JS que
// ClerkProvider (session-providers, que se carga aparte para que la portada no baje
// Clerk). Importados directamente desde "@clerk/nextjs", el empaquetador metía otra
// copia del núcleo de Clerk en el JS de la página (~48 KB comprimidos de más en
// entrar, crear cuenta y cuenta)
export const SignIn = dynamic(() => import("./session-providers").then((m) => m.SignIn))
export const SignUp = dynamic(() => import("./session-providers").then((m) => m.SignUp))
export const UserProfile = dynamic(() => import("./session-providers").then((m) => m.UserProfile))
export const DeleteAccount = dynamic(() => import("./session-providers").then((m) => m.DeleteAccount))
