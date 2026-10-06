// Paso 9 · GET interact_url → NO seguir el redirect 302
// Pegar en: Request "9. Abrir interacción" → Script → Pre Request
// (la firma global NO se aplica a este paso: no hay body ni GNAP)
req.setMaxRedirects(0);
