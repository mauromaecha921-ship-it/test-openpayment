// Paso 12 · GET .../finish → NO seguir el redirect 302
// Pegar en: Request "12. Finish" → Script → Pre Request
// (la firma global NO se aplica a este paso: va con cookie, sin body ni GNAP)
req.setMaxRedirects(0);
