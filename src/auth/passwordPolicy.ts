const consecutiveDigits = /012|123|234|345|456|567|678|789|987|876|765|654|543|432|321|210/;

export function passwordRules(password: string) {
  const length = Array.from(password).length;
  return [
    { label: "Entre 8 y 12 caracteres", valid: length >= 8 && length <= 12 },
    { label: "Al menos un carácter especial, como !, @ o #", valid: /[\p{P}\p{S}]/u.test(password) },
    { label: "Sin secuencias de tres o más números, como 123 o 987", valid: !consecutiveDigits.test(password) },
  ];
}

export function isNewPasswordValid(password: string) {
  return passwordRules(password).every(rule => rule.valid);
}
