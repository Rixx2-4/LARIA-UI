import { esES } from "@clerk/localizations"

// Clerk en español trata de usted; Plenum tutea. Se cambian los textos que más se
// ven al entrar y registrarse (y los que Clerk deja sin traducir)
export const clerkLocalization = {
  ...esES,
  formFieldInputPlaceholder__emailAddress: "tu@correo.com",
  formFieldInputPlaceholder__emailAddress_username: "Tu correo o nombre de usuario",
  formFieldInputPlaceholder__username: "Tu nombre de usuario",
  formFieldInputPlaceholder__password: "Tu contraseña",
  formFieldInputPlaceholder__signUpPassword: "Crea una contraseña",
  formFieldInputPlaceholder__firstName: "Tu nombre",
  formFieldInputPlaceholder__lastName: "Tus apellidos",
  formFieldInputPlaceholder__backupCode: "Tu código de respaldo",
  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn?.start,
      title: "Entrar",
      subtitle: "para seguir estudiando con LARIA",
      actionText: "¿No tienes cuenta?",
      actionLink: "Regístrate",
    },
  },
  signUp: {
    ...esES.signUp,
    start: {
      ...esES.signUp?.start,
      title: "Crea tu cuenta",
      subtitle: "para estudiar con LARIA en Plenum",
      actionText: "¿Ya tienes cuenta?",
      actionLink: "Entrar",
    },
  },
} satisfies typeof esES
