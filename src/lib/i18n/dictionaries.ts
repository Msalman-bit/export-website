import type { Locale } from './config';
import { LOCALES } from './config';

/* Interface words in six languages, as [en, de, fr, es, it, nl]. English is the source; the other
   five are drafts for review by a native speaker (Admin > Translations shows each as draft until a
   reviewer saves it). Long-form page and product copy is English until reviewed translations exist. */

const T = {
  skip: ['Skip to content', 'Zum Inhalt', 'Aller au contenu', 'Ir al contenido', 'Vai al contenuto', 'Naar de inhoud'],
  'nav.main': ['Main', 'Hauptmenü', 'Principal', 'Principal', 'Principale', 'Hoofdmenu'],
  'nav.products': ['Products', 'Produkte', 'Produits', 'Productos', 'Prodotti', 'Producten'],
  'nav.manufacturing': ['Manufacturing', 'Fertigung', 'Fabrication', 'Fabricación', 'Produzione', 'Productie'],
  'nav.customisation': ['Customisation', 'Individualisierung', 'Personnalisation', 'Personalización', 'Personalizzazione', 'Maatwerk'],
  'nav.resources': ['Resources', 'Ressourcen', 'Ressources', 'Recursos', 'Risorse', 'Informatie'],
  'nav.about': ['About', 'Über uns', 'À propos', 'Empresa', 'Chi siamo', 'Over ons'],
  'nav.signIn': ['Sign in', 'Anmelden', 'Connexion', 'Iniciar sesión', 'Accedi', 'Inloggen'],
  'nav.account': ['Account', 'Konto', 'Compte', 'Cuenta', 'Account', 'Account'],
  'nav.search': ['Search products', 'Produkte suchen', 'Rechercher des produits', 'Buscar productos', 'Cerca prodotti', 'Producten zoeken'],
  'nav.menu': ['Menu', 'Menü', 'Menu', 'Menú', 'Menu', 'Menu'],
  'nav.language': ['Language', 'Sprache', 'Langue', 'Idioma', 'Lingua', 'Taal'],
  'nav.basket': ['Inquiry list', 'Anfrageliste', 'Liste de demande', 'Lista de consulta', 'Lista richiesta', 'Aanvraaglijst'],
  'cta.quote': ['Request a quote', 'Angebot anfragen', 'Demander un devis', 'Solicitar presupuesto', 'Richiedi un preventivo', 'Offerte aanvragen'],
  'cta.catalogue': ['See the catalogue', 'Katalog ansehen', 'Voir le catalogue', 'Ver el catálogo', 'Vedi il catalogo', 'Bekijk de catalogus'],
  'cta.sample': ['Request a sample', 'Muster anfragen', 'Demander un échantillon', 'Solicitar una muestra', 'Richiedi un campione', 'Sample aanvragen'],
  'cta.add': ['Add to inquiry', 'Zur Anfrage hinzufügen', 'Ajouter à la demande', 'Añadir a la consulta', 'Aggiungi alla richiesta', 'Toevoegen aan aanvraag'],
  'cta.added': ['Added to your inquiry', 'Zur Anfrage hinzugefügt', 'Ajouté à votre demande', 'Añadido a su consulta', 'Aggiunto alla richiesta', 'Toegevoegd aan uw aanvraag'],
  'cta.configure': ['Configure a football', 'Fußball gestalten', 'Configurer un ballon', 'Configurar un balón', 'Configura un pallone', 'Voetbal ontwerpen'],
  'cta.datasheet': ['Download the datasheet', 'Datenblatt herunterladen', 'Télécharger la fiche technique', 'Descargar la ficha técnica', 'Scarica la scheda tecnica', 'Download het datablad'],
  'cta.save': ['Save product', 'Produkt merken', 'Enregistrer le produit', 'Guardar producto', 'Salva prodotto', 'Product bewaren'],
  'footer.products': ['Products', 'Produkte', 'Produits', 'Productos', 'Prodotti', 'Producten'],
  'footer.manufacturing': ['Manufacturing', 'Fertigung', 'Fabrication', 'Fabricación', 'Produzione', 'Productie'],
  'footer.company': ['Company', 'Unternehmen', 'Entreprise', 'Empresa', 'Azienda', 'Bedrijf'],
  'footer.support': ['Support', 'Service', 'Assistance', 'Asistencia', 'Assistenza', 'Service'],
  'footer.newsletter': ['Newsletter', 'Newsletter', 'Newsletter', 'Boletín', 'Newsletter', 'Nieuwsbrief'],
  'footer.newsletterLine': ['New product families and order dates, about once a month.', 'Neue Produktfamilien und Bestelltermine, etwa einmal im Monat.', 'Nouvelles familles de produits et dates de commande, environ une fois par mois.', 'Nuevas familias de productos y fechas de pedido, más o menos una vez al mes.', 'Nuove famiglie di prodotti e date d’ordine, circa una volta al mese.', 'Nieuwe productfamilies en besteldata, ongeveer één keer per maand.'],
  'footer.email': ['Work email', 'Geschäftliche E-Mail', 'E-mail professionnel', 'Correo profesional', 'Email di lavoro', 'Zakelijk e-mailadres'],
  'footer.emailError': ['Write an email address with an @, like name@club.com.', 'Bitte eine E-Mail-Adresse mit @ eingeben, z. B. name@verein.de.', 'Saisissez une adresse e-mail avec un @, par exemple nom@club.fr.', 'Escriba un correo con @, por ejemplo nombre@club.es.', 'Scrivi un indirizzo email con la @, ad esempio nome@club.it.', 'Vul een e-mailadres met een @ in, bijvoorbeeld naam@club.nl.'],
  'footer.subscribe': ['Subscribe', 'Abonnieren', 'S’abonner', 'Suscribirse', 'Iscriviti', 'Inschrijven'],
  'footer.subscribed': ['You are subscribed. Every email has an unsubscribe link.', 'Sie sind angemeldet. Jede E-Mail enthält einen Abmeldelink.', 'Vous êtes inscrit. Chaque e-mail contient un lien de désinscription.', 'Ya está suscrito. Cada correo incluye un enlace para darse de baja.', 'Iscrizione confermata. Ogni email contiene un link per annullarla.', 'U bent ingeschreven. Elke e-mail bevat een afmeldlink.'],
  'footer.privacy': ['Privacy', 'Datenschutz', 'Confidentialité', 'Privacidad', 'Privacy', 'Privacy'],
  'footer.cookies': ['Cookies', 'Cookies', 'Cookies', 'Cookies', 'Cookie', 'Cookies'],
  'footer.terms': ['Terms', 'AGB', 'Conditions', 'Condiciones', 'Termini', 'Voorwaarden'],
  'footer.accessibility': ['Accessibility', 'Barrierefreiheit', 'Accessibilité', 'Accesibilidad', 'Accessibilità', 'Toegankelijkheid'],
  'footer.contactForm': ['Contact form', 'Kontaktformular', 'Formulaire de contact', 'Formulario de contacto', 'Modulo di contatto', 'Contactformulier'],
  'footer.emailUs': ['Email us', 'E-Mail senden', 'Nous écrire', 'Escríbanos', 'Scrivici', 'Mail ons'],
  'footer.portal': ['Customer portal', 'Kundenportal', 'Espace client', 'Portal de clientes', 'Area clienti', 'Klantenportaal'],
  'footer.line': ['Sports equipment made in Pakistan under your brand, for clubs, distributors and brands abroad.', 'Sportausrüstung aus Pakistan unter Ihrer Marke, für Vereine, Händler und Marken im Ausland.', 'Équipements sportifs fabriqués au Pakistan sous votre marque, pour les clubs, distributeurs et marques à l’étranger.', 'Equipamiento deportivo fabricado en Pakistán con su marca, para clubes, distribuidores y marcas en el extranjero.', 'Attrezzatura sportiva prodotta in Pakistan con il vostro marchio, per club, distributori e marchi all’estero.', 'Sportartikelen gemaakt in Pakistan onder uw merk, voor clubs, distributeurs en merken in het buitenland.'],
  'basket.title': ['Your inquiry list', 'Ihre Anfrageliste', 'Votre liste de demande', 'Su lista de consulta', 'La tua lista richiesta', 'Uw aanvraaglijst'],
  'basket.empty': ['Your inquiry list is empty. Add products from the catalogue, or describe what you need below.', 'Ihre Anfrageliste ist leer. Fügen Sie Produkte aus dem Katalog hinzu oder beschreiben Sie unten, was Sie brauchen.', 'Votre liste est vide. Ajoutez des produits du catalogue ou décrivez votre besoin ci-dessous.', 'Su lista está vacía. Añada productos del catálogo o describa lo que necesita abajo.', 'La lista è vuota. Aggiungi prodotti dal catalogo o descrivi qui sotto ciò che ti serve.', 'Uw lijst is leeg. Voeg producten toe uit de catalogus of beschrijf hieronder wat u nodig heeft.'],
  'basket.quantity': ['Quantity', 'Menge', 'Quantité', 'Cantidad', 'Quantità', 'Aantal'],
  'basket.remove': ['Remove', 'Entfernen', 'Retirer', 'Quitar', 'Rimuovi', 'Verwijderen'],
  'basket.notes': ['Notes for this product', 'Hinweise zu diesem Produkt', 'Remarques sur ce produit', 'Notas sobre este producto', 'Note su questo prodotto', 'Opmerkingen bij dit product'],
  'search.short': ['Search', 'Suche', 'Rechercher', 'Buscar', 'Cerca', 'Zoeken'],
  'search.all': ['See all results', 'Alle Ergebnisse ansehen', 'Voir tous les résultats', 'Ver todos los resultados', 'Vedi tutti i risultati', 'Alle resultaten bekijken'],
  'search.label': ['Search the catalogue', 'Katalog durchsuchen', 'Rechercher dans le catalogue', 'Buscar en el catálogo', 'Cerca nel catalogo', 'Zoek in de catalogus'],
  'search.none': ['No products match. Try a shorter word, such as “glove” or “ball”.', 'Keine Treffer. Versuchen Sie ein kürzeres Wort, etwa „Handschuh“ oder „Ball“.', 'Aucun produit. Essayez un mot plus court, comme « gant » ou « ballon ».', 'Sin resultados. Pruebe una palabra más corta, como «guante» o «balón».', 'Nessun prodotto. Prova una parola più breve, come “guanto” o “pallone”.', 'Geen producten. Probeer een korter woord, zoals “handschoen” of “bal”.'],
  'product.sku': ['SKU', 'Artikelnummer', 'Référence', 'Referencia', 'Codice', 'Artikelnummer'],
  'product.specs': ['Specification', 'Spezifikation', 'Caractéristiques', 'Especificación', 'Specifiche', 'Specificaties'],
  'product.construction': ['Construction', 'Bauweise', 'Construction', 'Construcción', 'Costruzione', 'Constructie'],
  'product.materials': ['Materials', 'Materialien', 'Matériaux', 'Materiales', 'Materiali', 'Materialen'],
  'product.sizes': ['Sizes', 'Größen', 'Tailles', 'Tallas', 'Taglie', 'Maten'],
  'product.weight': ['Weight', 'Gewicht', 'Poids', 'Peso', 'Peso', 'Gewicht'],
  'product.colours': ['Colours', 'Farben', 'Couleurs', 'Colores', 'Colori', 'Kleuren'],
  'product.branding': ['Branding you can request', 'Mögliche Veredelung', 'Marquage possible', 'Marcaje disponible', 'Personalizzazione richiedibile', 'Mogelijke bedrukking'],
  'product.packaging': ['Packaging you can request', 'Mögliche Verpackung', 'Emballage possible', 'Embalaje disponible', 'Imballaggio richiedibile', 'Mogelijke verpakking'],
  'product.moq': ['Minimum order', 'Mindestmenge', 'Commande minimum', 'Pedido mínimo', 'Ordine minimo', 'Minimale bestelling'],
  'product.leadTime': ['Production lead time', 'Produktionszeit', 'Délai de production', 'Plazo de producción', 'Tempi di produzione', 'Productietijd'],
  'product.testing': ['Testing standards', 'Prüfnormen', 'Normes d’essai', 'Normas de ensayo', 'Standard di prova', 'Testnormen'],
  'product.onQuote': ['Confirmed in your quotation', 'Wird im Angebot bestätigt', 'Confirmé dans votre devis', 'Se confirma en su presupuesto', 'Confermato nel preventivo', 'Bevestigd in uw offerte'],
  'product.related': ['Related products', 'Ähnliche Produkte', 'Produits associés', 'Productos relacionados', 'Prodotti correlati', 'Gerelateerde producten'],
  'filter.all': ['All', 'Alle', 'Tous', 'Todos', 'Tutti', 'Alle'],
  'filter.construction': ['Construction', 'Bauweise', 'Construction', 'Construcción', 'Costruzione', 'Constructie'],
  'filter.type': ['Type', 'Art', 'Type', 'Tipo', 'Tipo', 'Soort'],
  'filter.studio': ['Configurable in the studio', 'Im Studio gestaltbar', 'Personnalisable dans le studio', 'Configurable en el estudio', 'Configurabile nello studio', 'Te ontwerpen in de studio'],
  'filter.result': ['product', 'Produkt', 'produit', 'producto', 'prodotto', 'product'],
  'filter.results': ['products', 'Produkte', 'produits', 'productos', 'prodotti', 'producten'],
} as const satisfies Record<string, readonly [string, string, string, string, string, string]>;

export type DictKey = keyof typeof T;
export type Dict = Record<DictKey, string>;

const cache = new Map<Locale, Dict>();

export function dictionary(locale: Locale, overrides?: Record<string, string>): Dict {
  if (!overrides && cache.has(locale)) return cache.get(locale)!;
  const i = LOCALES.indexOf(locale);
  const out = {} as Dict;
  for (const k of Object.keys(T) as DictKey[]) out[k] = overrides?.[k] ?? T[k][i] ?? T[k][0];
  if (!overrides) cache.set(locale, out);
  return out;
}

/** Every key with its English source, for the admin translation screen. */
export function sourceStrings(): { key: DictKey; en: string; drafts: Record<Locale, string> }[] {
  return (Object.keys(T) as DictKey[]).map((key) => ({
    key,
    en: T[key][0],
    drafts: Object.fromEntries(LOCALES.map((l, i) => [l, T[key][i]])) as Record<Locale, string>,
  }));
}
