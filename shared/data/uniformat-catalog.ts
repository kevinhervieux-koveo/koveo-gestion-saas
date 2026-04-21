/**
 * UNIFORMAT II Catalog for Quebec Construction Standards
 * 
 * This catalog provides comprehensive UNIFORMAT Level 3 building element data
 * specifically tailored for Quebec construction conditions, including:
 * - French and English terminology using Quebec construction vocabulary
 * - Typical lifespans adjusted for Quebec climate (harsh winters, freeze-thaw cycles)
 * - Common Quebec building elements (flat roofs, cold climate exterior systems, etc.)
 * - Complete hierarchical structure from Level 1 to Level 3
 * - Elements can only be created at Level 3 (Levels 1-2 are for grouping only)
 * 
 * Categories:
 * A - Substructure: Foundations, basement construction
 * B - Shell: Superstructure, exterior enclosure, roofing
 * C - Interiors: Interior construction, stairs, finishes
 * D - Services: Conveying, plumbing, HVAC, fire protection, electrical
 * E - Equipment & Furnishings
 * F - Special Construction & Demolition
 * G - Building Sitework
 */

export interface UniformatElement {
  code: string;
  level: number;
  parentCode?: string;
  nameFr: string;
  nameEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
  typicalLifespan?: number;
  category: string;
  synonymsEn?: string[];
  synonymsFr?: string[];
}

export const UNIFORMAT_CATALOG: UniformatElement[] = [
  // LEVEL 1 - MAJOR GROUP ELEMENTS
  {
    code: "A",
    level: 1,
    nameFr: "Infrastructure",
    nameEn: "Substructure", 
    descriptionFr: "Éléments de fondation et d'infrastructure souterraine",
    descriptionEn: "Foundation and below-grade infrastructure elements",
    category: "Substructure"
  },
  {
    code: "B", 
    level: 1,
    nameFr: "Enveloppe du bâtiment",
    nameEn: "Shell",
    descriptionFr: "Structure, enveloppe extérieure et toiture du bâtiment",
    descriptionEn: "Building structure, exterior enclosure and roofing",
    category: "Shell"
  },
  {
    code: "C",
    level: 1, 
    nameFr: "Aménagements intérieurs",
    nameEn: "Interiors",
    descriptionFr: "Construction intérieure, escaliers et finitions",
    descriptionEn: "Interior construction, stairs and finishes",
    category: "Interiors"
  },
  {
    code: "D",
    level: 1,
    nameFr: "Services du bâtiment", 
    nameEn: "Services",
    descriptionFr: "Transport vertical, plomberie, CVC, protection incendie, électricité",
    descriptionEn: "Conveying, plumbing, HVAC, fire protection, electrical",
    category: "Services"
  },
  {
    code: "E",
    level: 1,
    nameFr: "Équipements et ameublement",
    nameEn: "Equipment & Furnishings", 
    descriptionFr: "Équipements spécialisés et ameublement",
    descriptionEn: "Specialized equipment and furnishings",
    category: "Equipment & Furnishings"
  },
  {
    code: "F",
    level: 1,
    nameFr: "Construction spécialisée et démolition",
    nameEn: "Special Construction & Demolition",
    descriptionFr: "Constructions spécialisées et travaux de démolition", 
    descriptionEn: "Special construction and demolition work",
    category: "Special Construction & Demolition"
  },
  {
    code: "G",
    level: 1,
    nameFr: "Aménagement du terrain",
    nameEn: "Building Sitework",
    descriptionFr: "Travaux d'aménagement du site et infrastructure externe",
    descriptionEn: "Site development and external infrastructure work",
    category: "Building Sitework"
  },

  // LEVEL 2 - GROUP ELEMENTS
  // A - SUBSTRUCTURE
  {
    code: "A10",
    level: 2,
    parentCode: "A",
    nameFr: "Fondations",
    nameEn: "Foundations",
    descriptionFr: "Systèmes de fondations et semelles",
    descriptionEn: "Foundation systems and footings",
    category: "Substructure"
  },
  {
    code: "A20", 
    level: 2,
    parentCode: "A",
    nameFr: "Construction souterraine",
    nameEn: "Basement Construction",
    descriptionFr: "Murs de fondation, dalles et construction sous le niveau du sol",
    descriptionEn: "Foundation walls, slabs and below-grade construction",
    category: "Substructure"
  },

  // B - SHELL
  {
    code: "B10",
    level: 2,
    parentCode: "B", 
    nameFr: "Superstructure",
    nameEn: "Superstructure",
    descriptionFr: "Système structural principal au-dessus du niveau du sol",
    descriptionEn: "Main structural system above grade",
    category: "Shell"
  },
  {
    code: "B20",
    level: 2,
    parentCode: "B",
    nameFr: "Enveloppe extérieure",
    nameEn: "Exterior Enclosure", 
    descriptionFr: "Murs extérieurs, fenêtres et portes extérieures",
    descriptionEn: "Exterior walls, windows and exterior doors",
    category: "Shell"
  },
  {
    code: "B30",
    level: 2,
    parentCode: "B",
    nameFr: "Toiture",
    nameEn: "Roofing",
    descriptionFr: "Système de toiture, isolation et étanchéité",
    descriptionEn: "Roofing system, insulation and waterproofing",
    category: "Shell"
  },

  // C - INTERIORS  
  {
    code: "C10",
    level: 2,
    parentCode: "C",
    nameFr: "Construction intérieure",
    nameEn: "Interior Construction",
    descriptionFr: "Cloisons, portes intérieures et spécialités architecturales",
    descriptionEn: "Partitions, interior doors and architectural specialties",
    category: "Interiors"
  },
  {
    code: "C20",
    level: 2,
    parentCode: "C",
    nameFr: "Escaliers",
    nameEn: "Stairs", 
    descriptionFr: "Escaliers intérieurs et extérieurs",
    descriptionEn: "Interior and exterior stairs",
    category: "Interiors"
  },
  {
    code: "C30",
    level: 2,
    parentCode: "C", 
    nameFr: "Finitions intérieures",
    nameEn: "Interior Finishes",
    descriptionFr: "Revêtements de sol, murs et plafonds",
    descriptionEn: "Floor, wall and ceiling finishes",
    category: "Interiors"
  },

  // D - SERVICES
  {
    code: "D10",
    level: 2,
    parentCode: "D",
    nameFr: "Transport vertical",
    nameEn: "Conveying",
    descriptionFr: "Ascenseurs, escaliers mécaniques et systèmes de transport",
    descriptionEn: "Elevators, escalators and transportation systems", 
    category: "Services"
  },
  {
    code: "D20",
    level: 2,
    parentCode: "D",
    nameFr: "Plomberie",
    nameEn: "Plumbing",
    descriptionFr: "Systèmes de plomberie et équipements sanitaires",
    descriptionEn: "Plumbing systems and fixtures",
    category: "Services"
  },
  {
    code: "D30",
    level: 2,
    parentCode: "D",
    nameFr: "CVC",
    nameEn: "HVAC",
    descriptionFr: "Chauffage, ventilation et climatisation",
    descriptionEn: "Heating, ventilating and air conditioning",
    category: "Services"
  },
  {
    code: "D40",
    level: 2,
    parentCode: "D",
    nameFr: "Protection incendie",
    nameEn: "Fire Protection",
    descriptionFr: "Systèmes de détection et suppression d'incendie",
    descriptionEn: "Fire detection and suppression systems",
    category: "Services"
  },
  {
    code: "D50",
    level: 2,
    parentCode: "D",
    nameFr: "Électricité",
    nameEn: "Electrical",
    descriptionFr: "Systèmes électriques et éclairage",
    descriptionEn: "Electrical systems and lighting",
    category: "Services"
  },

  // E - EQUIPMENT & FURNISHINGS
  {
    code: "E10",
    level: 2,
    parentCode: "E",
    nameFr: "Équipements spécialisés",
    nameEn: "Equipment",
    descriptionFr: "Équipements spécialisés du bâtiment",
    descriptionEn: "Specialized building equipment",
    category: "Equipment & Furnishings"
  },
  {
    code: "E20",
    level: 2,
    parentCode: "E",
    nameFr: "Ameublement",
    nameEn: "Furnishings",
    descriptionFr: "Ameublement fixe et mobilier",
    descriptionEn: "Fixed furnishings and furniture",
    category: "Equipment & Furnishings"
  },

  // F - SPECIAL CONSTRUCTION & DEMOLITION
  {
    code: "F10",
    level: 2,
    parentCode: "F",
    nameFr: "Construction spécialisée",
    nameEn: "Special Construction",
    descriptionFr: "Constructions et structures spécialisées",
    descriptionEn: "Specialized construction and structures",
    category: "Special Construction & Demolition"
  },
  {
    code: "F20",
    level: 2,
    parentCode: "F",
    nameFr: "Démolition sélective",
    nameEn: "Selective Demolition",
    descriptionFr: "Travaux de démolition sélective",
    descriptionEn: "Selective demolition work",
    category: "Special Construction & Demolition"
  },

  // G - BUILDING SITEWORK
  {
    code: "G10",
    level: 2,
    parentCode: "G",
    nameFr: "Préparation du site",
    nameEn: "Site Preparation",
    descriptionFr: "Déblaiement, excavation et préparation du terrain",
    descriptionEn: "Site clearing, excavation and preparation",
    category: "Building Sitework"
  },
  {
    code: "G20",
    level: 2,
    parentCode: "G",
    nameFr: "Amélioration du site",
    nameEn: "Site Improvements",
    descriptionFr: "Aménagement paysager et améliorations du site",
    descriptionEn: "Landscaping and site improvements",
    category: "Building Sitework"
  },
  {
    code: "G30",
    level: 2,
    parentCode: "G",
    nameFr: "Équipements du site",
    nameEn: "Site Mechanical Utilities",
    descriptionFr: "Services mécaniques et utilitaires du site",
    descriptionEn: "Site mechanical and utility services",
    category: "Building Sitework"
  },
  {
    code: "G40",
    level: 2,
    parentCode: "G",
    nameFr: "Services électriques du site",
    nameEn: "Site Electrical Utilities",
    descriptionFr: "Services électriques et communications du site",
    descriptionEn: "Site electrical and communication services",
    category: "Building Sitework"
  },

  // LEVEL 3 - SUB-GROUP ELEMENTS (Only level 3 elements can have building elements created)

  // A10 - FOUNDATIONS
  {
    code: "A1010",
    level: 3,
    parentCode: "A10",
    nameFr: "Fondations standard",
    nameEn: "Standard Foundations",
    descriptionFr: "Fondations en béton coulé sur place et préfabriquées",
    descriptionEn: "Cast-in-place and precast concrete foundations",
    typicalLifespan: 75,
    category: "Substructure",
    synonymsEn: ["footing", "footings", "concrete foundation", "spread footing", "strip footing", "mat foundation", "raft foundation", "slab foundation", "base", "underpinning", "foundation base", "foundation footer", "grade beam", "frost wall"],
    synonymsFr: ["semelle", "semelles", "fondation en béton", "semelle filante", "semelle isolée", "radier", "base", "assise", "empattement", "solage", "mur de fondation", "fondation coulée", "béton de fondation"]
  },
  {
    code: "A1020",
    level: 3,
    parentCode: "A10",
    nameFr: "Fondations spéciales",
    nameEn: "Special Foundations",
    descriptionFr: "Pieux, caissons et fondations spécialisées",
    descriptionEn: "Piles, caissons and specialized foundations",
    typicalLifespan: 60,
    category: "Substructure",
    synonymsEn: ["piles", "pile foundation", "drilled shaft", "driven pile", "helical pile", "screw pile", "caisson", "pier foundation", "deep foundation", "micropile", "auger pile", "bored pile", "friction pile", "end-bearing pile"],
    synonymsFr: ["pieux", "pieu", "caisson", "pilotis", "pieu vissé", "pieu hélicoïdal", "micropieu", "pieu foré", "pieu battu", "fondation profonde", "pieu de friction", "pieu porteur", "ancrage profond"]
  },
  {
    code: "A1030",
    level: 3,
    parentCode: "A10",
    nameFr: "Drainage de fondation",
    nameEn: "Foundation Drainage",
    descriptionFr: "Systèmes de drainage autour des fondations",
    descriptionEn: "Foundation drainage systems",
    typicalLifespan: 30,
    category: "Substructure",
    synonymsEn: ["french drain", "weeping tile", "drain tile", "perimeter drain", "footer drain", "sump pump", "drainage pipe", "gravel drain", "footing drain", "basement drain", "subsurface drain", "foundation drain pipe", "water management"],
    synonymsFr: ["drain français", "drain de fondation", "tuyau de drainage", "drain périmétrique", "puisard", "pompe de puisard", "drain weeping tile", "système de drainage", "évacuation eau", "drain souterrain", "gouttière souterraine", "tuyau perforé"]
  },
  {
    code: "A1040",
    level: 3,
    parentCode: "A10",
    nameFr: "Imperméabilisation des fondations",
    nameEn: "Foundation Waterproofing",
    descriptionFr: "Systèmes d'imperméabilisation des fondations",
    descriptionEn: "Foundation waterproofing systems",
    typicalLifespan: 25,
    category: "Substructure",
    synonymsEn: ["waterproof membrane", "damp proofing", "waterproof coating", "foundation sealer", "moisture barrier", "water barrier", "basement waterproofing", "tar coating", "bitumen", "rubberized coating", "foundation wrap", "water infiltration", "leak prevention", "wet basement"],
    synonymsFr: ["membrane imperméable", "imperméabilisation", "étanchéité", "scellant de fondation", "pare-vapeur", "barrière d'humidité", "goudron", "bitume", "enduit imperméable", "protection contre l'eau", "infiltration d'eau", "sous-sol humide", "crépi de fondation"]
  },

  // A20 - BASEMENT CONSTRUCTION
  {
    code: "A2010",
    level: 3,
    parentCode: "A20",
    nameFr: "Murs de fondation",
    nameEn: "Foundation Walls",
    descriptionFr: "Murs de fondation en béton et en maçonnerie",
    descriptionEn: "Concrete and masonry foundation walls",
    typicalLifespan: 75,
    category: "Substructure",
    synonymsEn: ["basement walls", "concrete walls", "block walls", "cinder block", "CMU walls", "poured walls", "retaining wall", "below grade walls", "cellar walls", "underground walls", "frost wall", "stem wall", "foundation block"],
    synonymsFr: ["murs de sous-sol", "murs en béton", "murs de blocs", "bloc de béton", "mur de soutènement", "mur coulé", "mur hors sol", "mur enterré", "mur de cave", "paroi de fondation", "mur porteur", "solage"]
  },
  {
    code: "A2020",
    level: 3,
    parentCode: "A20",
    nameFr: "Dalles de sous-sol",
    nameEn: "Basement Slabs",
    descriptionFr: "Dalles de plancher des sous-sols",
    descriptionEn: "Basement floor slabs",
    typicalLifespan: 50,
    category: "Substructure",
    synonymsEn: ["concrete floor", "basement floor", "slab on grade", "floor slab", "cellar floor", "concrete slab", "basement concrete", "ground floor slab", "subgrade slab", "foundation slab", "garage floor", "cracked slab", "uneven floor"],
    synonymsFr: ["dalle de béton", "plancher de sous-sol", "dalle sur sol", "plancher de béton", "sol de cave", "plancher de garage", "dalle fissurée", "dalle de fondation", "sol en béton", "radier", "chape de béton"]
  },
  {
    code: "A2030",
    level: 3,
    parentCode: "A20",
    nameFr: "Isolation du sous-sol",
    nameEn: "Basement Insulation",
    descriptionFr: "Isolation thermique des murs et dalles de sous-sol",
    descriptionEn: "Thermal insulation for basement walls and slabs",
    typicalLifespan: 30,
    category: "Substructure",
    synonymsEn: ["foam insulation", "rigid foam", "spray foam", "fiberglass batt", "wall insulation", "floor insulation", "R-value", "thermal barrier", "insulation board", "XPS", "EPS", "polystyrene", "basement wrap", "cold basement", "drafty basement"],
    synonymsFr: ["isolant", "mousse isolante", "mousse pulvérisée", "laine de verre", "polystyrène", "panneau isolant", "isolation thermique", "valeur R", "styromousse", "uréthane", "isolation giclée", "sous-sol froid", "courant d'air"]
  },
  {
    code: "A2040",
    level: 3,
    parentCode: "A20",
    nameFr: "Finitions de sous-sol",
    nameEn: "Basement Finishes",
    descriptionFr: "Revêtements et finitions des espaces de sous-sol",
    descriptionEn: "Basement space coatings and finishes",
    typicalLifespan: 20,
    category: "Substructure",
    synonymsEn: ["basement finishing", "drywall", "ceiling tiles", "drop ceiling", "basement flooring", "epoxy floor", "painted walls", "finished basement", "recreation room", "basement renovation", "basement remodel", "man cave", "basement apartment", "basement suite"],
    synonymsFr: ["finition de sous-sol", "gypse", "plafond suspendu", "plancher de sous-sol", "époxy", "peinture murale", "sous-sol fini", "salle de jeux", "rénovation sous-sol", "logement au sous-sol", "appartement sous-sol", "aménagement sous-sol"]
  },

  // B10 - SUPERSTRUCTURE
  {
    code: "B1010",
    level: 3,
    parentCode: "B10",
    nameFr: "Structure en béton",
    nameEn: "Concrete Structure",
    descriptionFr: "Éléments de structure en béton armé",
    descriptionEn: "Reinforced concrete structural elements",
    typicalLifespan: 75,
    category: "Shell",
    synonymsEn: ["reinforced concrete", "concrete beam", "concrete column", "concrete frame", "precast concrete", "post-tensioned", "concrete slab", "shear wall", "concrete core", "structural concrete", "rebar", "reinforcement", "spalling", "concrete crack"],
    synonymsFr: ["béton armé", "poutre de béton", "colonne de béton", "ossature béton", "béton préfabriqué", "précontraint", "dalle de béton", "mur de cisaillement", "armature", "ferraillage", "éclatement du béton", "fissure béton"]
  },
  {
    code: "B1020",
    level: 3,
    parentCode: "B10",
    nameFr: "Structure en acier",
    nameEn: "Steel Structure",
    descriptionFr: "Charpente et éléments structuraux en acier",
    descriptionEn: "Steel frame and structural elements",
    typicalLifespan: 60,
    category: "Shell",
    synonymsEn: ["steel beam", "I-beam", "steel column", "steel frame", "structural steel", "metal frame", "steel joist", "girder", "steel truss", "metal beam", "H-beam", "wide flange", "rust", "corrosion", "welded steel"],
    synonymsFr: ["poutre d'acier", "poutrelle", "colonne d'acier", "charpente métallique", "ossature acier", "structure métallique", "solive acier", "poutre en I", "ferme d'acier", "rouille", "corrosion", "acier soudé", "profilé"]
  },
  {
    code: "B1030",
    level: 3,
    parentCode: "B10",
    nameFr: "Structure en bois",
    nameEn: "Wood Structure",
    descriptionFr: "Charpente et éléments structuraux en bois",
    descriptionEn: "Wood frame and structural elements",
    typicalLifespan: 50,
    category: "Shell",
    synonymsEn: ["wood frame", "timber frame", "lumber", "wooden beam", "joist", "rafter", "stud", "post and beam", "glulam", "LVL", "engineered wood", "2x4", "framing", "rot", "termite", "wood decay"],
    synonymsFr: ["charpente de bois", "ossature bois", "poutre de bois", "solive", "chevron", "colombage", "poteau-poutre", "bois lamellé-collé", "bois d'ingénierie", "2x4", "montant", "pourriture", "termites", "moisissure bois"]
  },
  {
    code: "B1040",
    level: 3,
    parentCode: "B10",
    nameFr: "Planchers structuraux",
    nameEn: "Structural Floors",
    descriptionFr: "Systèmes de planchers structuraux",
    descriptionEn: "Structural floor systems",
    typicalLifespan: 60,
    category: "Shell",
    synonymsEn: ["floor joist", "floor system", "subfloor", "floor deck", "concrete deck", "metal deck", "floor truss", "composite floor", "floor framing", "sagging floor", "bouncy floor", "squeaky floor", "floor structure"],
    synonymsFr: ["solive de plancher", "système de plancher", "sous-plancher", "dalle de plancher", "pontage", "ferme de plancher", "plancher composite", "ossature de plancher", "plancher affaissé", "plancher qui craque", "structure de plancher"]
  },
  {
    code: "B1050",
    level: 3,
    parentCode: "B10",
    nameFr: "Toitures structurales",
    nameEn: "Structural Roofs",
    descriptionFr: "Systèmes de toiture structuraux",
    descriptionEn: "Structural roof systems",
    typicalLifespan: 50,
    category: "Shell",
    synonymsEn: ["roof truss", "roof joist", "rafter", "roof deck", "roof framing", "roof structure", "ridge beam", "purlin", "hip rafter", "valley rafter", "roof sheathing", "sagging roof", "roof collapse"],
    synonymsFr: ["ferme de toit", "chevron", "solive de toit", "pontage de toit", "charpente de toit", "structure de toiture", "faîtage", "panne", "arêtier", "noue", "revêtement de toit", "toit affaissé"]
  },

  // B20 - EXTERIOR ENCLOSURE
  {
    code: "B2010",
    level: 3,
    parentCode: "B20",
    nameFr: "Murs extérieurs en maçonnerie",
    nameEn: "Masonry Exterior Walls",
    descriptionFr: "Murs extérieurs en brique, bloc ou pierre",
    descriptionEn: "Brick, block or stone exterior walls",
    typicalLifespan: 60,
    category: "Shell",
    synonymsEn: ["brick wall", "stone wall", "block wall", "masonry", "brick veneer", "stone veneer", "CMU", "concrete block", "mortar", "pointing", "tuckpointing", "repointing", "brick crack", "efflorescence", "spalling brick"],
    synonymsFr: ["mur de brique", "mur de pierre", "mur de bloc", "maçonnerie", "parement de brique", "parement de pierre", "bloc de béton", "mortier", "jointement", "rejointoiement", "brique fissurée", "efflorescence", "éclatement brique"]
  },
  {
    code: "B2020",
    level: 3,
    parentCode: "B20",
    nameFr: "Murs-rideaux",
    nameEn: "Curtain Walls",
    descriptionFr: "Systèmes de murs-rideaux non porteurs",
    descriptionEn: "Non-bearing curtain wall systems",
    typicalLifespan: 35,
    category: "Shell",
    synonymsEn: ["glass wall", "glass facade", "aluminum curtain wall", "window wall", "storefront", "glazed wall", "unitized curtain wall", "stick curtain wall", "mullion", "spandrel", "vision glass", "structural glazing"],
    synonymsFr: ["mur de verre", "façade vitrée", "mur-rideau aluminium", "vitrine", "mur vitré", "meneau", "allège", "vitrage structural", "façade légère", "panneau de verre", "système de façade"]
  },
  {
    code: "B2030",
    level: 3,
    parentCode: "B20",
    nameFr: "Fenêtres",
    nameEn: "Windows",
    descriptionFr: "Fenêtres et systèmes de fenestration",
    descriptionEn: "Windows and fenestration systems",
    typicalLifespan: 30,
    category: "Shell",
    synonymsEn: ["glass", "pane", "frame", "sill", "glazing", "double-pane", "triple-pane", "casement", "sliding", "awning", "window seal", "window caulk", "foggy window", "broken window", "window replacement", "vinyl window", "aluminum window", "wood window", "window screen", "storm window"],
    synonymsFr: ["vitre", "vitrage", "châssis", "cadre", "appui", "double vitrage", "triple vitrage", "coulissante", "battante", "auvent", "scellant fenêtre", "fenêtre embuée", "fenêtre brisée", "remplacement fenêtre", "fenêtre PVC", "fenêtre aluminium", "fenêtre bois", "moustiquaire", "contre-fenêtre"]
  },
  {
    code: "B2040",
    level: 3,
    parentCode: "B20",
    nameFr: "Portes extérieures",
    nameEn: "Exterior Doors",
    descriptionFr: "Portes et systèmes d'entrée extérieurs",
    descriptionEn: "Exterior doors and entrance systems",
    typicalLifespan: 25,
    category: "Shell",
    synonymsEn: ["entry door", "front door", "back door", "side door", "patio door", "sliding door", "french door", "storm door", "screen door", "door frame", "threshold", "weatherstrip", "door seal", "door hardware", "deadbolt", "door lock", "door handle", "hinges"],
    synonymsFr: ["porte d'entrée", "porte avant", "porte arrière", "porte patio", "porte coulissante", "porte française", "contre-porte", "cadre de porte", "seuil", "coupe-froid", "joint de porte", "quincaillerie", "serrure", "poignée", "pentures", "verrou"]
  },
  {
    code: "B2050",
    level: 3,
    parentCode: "B20",
    nameFr: "Isolation extérieure",
    nameEn: "Exterior Insulation",
    descriptionFr: "Systèmes d'isolation thermique extérieure",
    descriptionEn: "Exterior thermal insulation systems",
    typicalLifespan: 30,
    category: "Shell",
    synonymsEn: ["EIFS", "exterior foam", "continuous insulation", "wall insulation", "rigid insulation", "spray foam", "thermal envelope", "R-value", "building wrap", "house wrap", "Tyvek", "air barrier", "vapor barrier", "thermal bridging"],
    synonymsFr: ["SIFE", "mousse extérieure", "isolation continue", "isolation murale", "isolation rigide", "mousse giclée", "enveloppe thermique", "valeur R", "pare-air", "pare-vapeur", "Tyvek", "pont thermique", "isolation par l'extérieur"]
  },
  {
    code: "B2060",
    level: 3,
    parentCode: "B20",
    nameFr: "Revêtements extérieurs",
    nameEn: "Exterior Cladding",
    descriptionFr: "Revêtements extérieurs en métal, vinyle ou composite",
    descriptionEn: "Metal, vinyl or composite exterior cladding",
    typicalLifespan: 25,
    category: "Shell",
    synonymsEn: ["siding", "vinyl siding", "aluminum siding", "metal siding", "fiber cement", "HardiePlank", "wood siding", "clapboard", "shingles", "stucco", "EIFS", "panel", "facade", "cladding", "exterior finish", "faded siding", "damaged siding"],
    synonymsFr: ["revêtement", "bardeau", "vinyle", "aluminium", "fibrociment", "bois", "déclin", "clins", "crépi", "stucco", "panneau", "façade", "parement", "finition extérieure", "revêtement décoloré", "revêtement endommagé", "canexel"]
  },
  {
    code: "B2070",
    level: 3,
    parentCode: "B20",
    nameFr: "Balcons et terrasses",
    nameEn: "Balconies and Terraces",
    descriptionFr: "Balcons, terrasses et espaces extérieurs",
    descriptionEn: "Balconies, terraces and outdoor spaces",
    typicalLifespan: 30,
    category: "Shell",
    synonymsEn: ["deck", "patio", "porch", "veranda", "gallery", "rooftop terrace", "balcony railing", "deck boards", "composite deck", "wood deck", "concrete balcony", "balcony membrane", "balcony drain", "rotting deck", "unsafe balcony"],
    synonymsFr: ["balcon", "terrasse", "patio", "galerie", "véranda", "perron", "garde-corps", "rampe", "planches de terrasse", "terrasse composite", "terrasse en bois", "balcon en béton", "membrane de balcon", "drain de balcon", "terrasse pourrie"]
  },

  // B30 - ROOFING
  {
    code: "B3010",
    level: 3,
    parentCode: "B30",
    nameFr: "Couverture de toiture",
    nameEn: "Roof Coverings",
    descriptionFr: "Matériaux de couverture et membranes",
    descriptionEn: "Roofing materials and membranes",
    typicalLifespan: 25,
    category: "Shell",
    synonymsEn: ["shingles", "asphalt shingles", "metal roof", "membrane", "flat roof", "tar", "gravel roof", "TPO", "EPDM", "rubber roof", "slate", "tile roof", "cedar shakes", "roof leak", "missing shingles", "roof repair", "reroof", "roof replacement"],
    synonymsFr: ["bardeaux", "bardeaux d'asphalte", "toit en métal", "membrane", "toit plat", "goudron", "gravier", "TPO", "EPDM", "caoutchouc", "ardoise", "tuile", "cèdre", "fuite de toit", "bardeaux manquants", "réparation toit", "refaire toiture", "remplacement toit"]
  },
  {
    code: "B3020",
    level: 3,
    parentCode: "B30",
    nameFr: "Ouvertures de toiture",
    nameEn: "Roof Openings",
    descriptionFr: "Lucarnes, puits de lumière et ouvertures",
    descriptionEn: "Dormers, skylights and roof openings",
    typicalLifespan: 25,
    category: "Shell",
    synonymsEn: ["skylight", "roof window", "dormer", "roof hatch", "access hatch", "smoke vent", "roof vent", "cupola", "clerestory", "light well", "leaking skylight", "foggy skylight", "skylight replacement"],
    synonymsFr: ["puits de lumière", "lucarne", "fenêtre de toit", "trappe de toit", "sortie de toit", "évent de fumée", "évent de toit", "lanterneau", "coupole", "puits de lumière qui fuit", "velux", "fenêtre de toiture"]
  },
  {
    code: "B3030",
    level: 3,
    parentCode: "B30",
    nameFr: "Isolation de toiture",
    nameEn: "Roof Insulation",
    descriptionFr: "Systèmes d'isolation thermique de toiture",
    descriptionEn: "Roof thermal insulation systems",
    typicalLifespan: 30,
    category: "Shell",
    synonymsEn: ["attic insulation", "blown-in insulation", "batt insulation", "rigid insulation", "spray foam", "roof R-value", "thermal insulation", "ice dam prevention", "ventilation", "soffit vent", "ridge vent", "cold roof", "hot roof"],
    synonymsFr: ["isolation de grenier", "isolation soufflée", "laine isolante", "isolation rigide", "mousse giclée", "valeur R toiture", "isolation thermique", "prévention barrière de glace", "ventilation", "soffite", "évent de faîte", "toit froid"]
  },
  {
    code: "B3040",
    level: 3,
    parentCode: "B30",
    nameFr: "Drainage de toiture",
    nameEn: "Roof Drainage",
    descriptionFr: "Gouttières, descentes pluviales et drainage",
    descriptionEn: "Gutters, downspouts and roof drainage",
    typicalLifespan: 20,
    category: "Shell",
    synonymsEn: ["gutters", "gutter", "downspout", "eavestroughs", "rain gutter", "gutter guard", "leaf guard", "scupper", "roof drain", "internal drain", "overflow drain", "clogged gutter", "leaking gutter", "ice dam", "gutter cleaning"],
    synonymsFr: ["gouttières", "gouttière", "descente pluviale", "dalot", "drain de toit", "protège-gouttière", "garde-feuilles", "gouttière bouchée", "gouttière qui fuit", "barrière de glace", "nettoyage gouttière", "trop-plein"]
  },
  {
    code: "B3050",
    level: 3,
    parentCode: "B30",
    nameFr: "Systèmes de sécurité toiture",
    nameEn: "Roof Safety Systems",
    descriptionFr: "Garde-corps, échelles et systèmes de sécurité",
    descriptionEn: "Guardrails, ladders and safety systems",
    typicalLifespan: 25,
    category: "Shell",
    synonymsEn: ["roof railing", "guardrail", "parapet", "roof ladder", "access ladder", "fall protection", "anchor point", "roof walkway", "safety rail", "roof access", "hatch ladder", "snow guard", "roof edge protection"],
    synonymsFr: ["garde-corps de toit", "parapet", "échelle de toit", "échelle d'accès", "protection contre les chutes", "point d'ancrage", "passerelle de toit", "rampe de sécurité", "accès au toit", "échelle de trappe", "arrête-neige", "protection de bord"]
  },

  // C10 - INTERIOR CONSTRUCTION
  {
    code: "C1010",
    level: 3,
    parentCode: "C10",
    nameFr: "Cloisons intérieures",
    nameEn: "Interior Partitions",
    descriptionFr: "Murs et cloisons non porteurs intérieurs",
    descriptionEn: "Interior non-bearing walls and partitions",
    typicalLifespan: 30,
    category: "Interiors",
    synonymsEn: ["drywall", "gypsum board", "sheetrock", "partition wall", "divider wall", "stud wall", "demising wall", "movable partition", "cubicle", "office wall", "room divider", "interior wall", "hole in wall", "crack in wall", "wall repair"],
    synonymsFr: ["gypse", "placoplâtre", "cloison", "mur de séparation", "mur intérieur", "cloison amovible", "division", "mur mitoyen", "trou dans le mur", "fissure au mur", "réparation murale", "gyproc", "panneau de gypse"]
  },
  {
    code: "C1020",
    level: 3,
    parentCode: "C10",
    nameFr: "Portes intérieures",
    nameEn: "Interior Doors",
    descriptionFr: "Portes et quincaillerie intérieures",
    descriptionEn: "Interior doors and hardware",
    typicalLifespan: 25,
    category: "Interiors",
    synonymsEn: ["bedroom door", "bathroom door", "closet door", "pocket door", "sliding door", "bifold door", "hollow core", "solid core", "door knob", "door handle", "hinges", "door frame", "door casing", "sticking door", "squeaky door", "broken door"],
    synonymsFr: ["porte de chambre", "porte de salle de bain", "porte de garde-robe", "porte coulissante", "porte escamotable", "porte pliante", "porte creuse", "porte pleine", "poignée de porte", "pentures", "cadre de porte", "chambranle", "porte qui colle", "porte qui grince", "porte brisée"]
  },
  {
    code: "C1030",
    level: 3,
    parentCode: "C10",
    nameFr: "Spécialités architecturales",
    nameEn: "Architectural Specialties",
    descriptionFr: "Éléments architecturaux spécialisés",
    descriptionEn: "Specialized architectural elements",
    typicalLifespan: 20,
    category: "Interiors",
    synonymsEn: ["mailbox", "mail slot", "bulletin board", "signage", "directory", "toilet partition", "bathroom stall", "locker", "corner guard", "wall protection", "handrail", "grab bar", "access panel", "fire extinguisher cabinet"],
    synonymsFr: ["boîte aux lettres", "babillard", "tableau d'affichage", "signalisation", "répertoire", "cloison de toilette", "cabine de toilette", "casier", "protège-coin", "protection murale", "main courante", "barre d'appui", "panneau d'accès", "cabinet d'extincteur"]
  },
  {
    code: "C1040",
    level: 3,
    parentCode: "C10",
    nameFr: "Armoires et rangements",
    nameEn: "Cabinets and Storage",
    descriptionFr: "Armoires intégrées et systèmes de rangement",
    descriptionEn: "Built-in cabinets and storage systems",
    typicalLifespan: 20,
    category: "Interiors",
    synonymsEn: ["kitchen cabinet", "bathroom vanity", "closet organizer", "built-in shelving", "storage unit", "pantry", "wardrobe", "cupboard", "drawer", "cabinet door", "cabinet hardware", "shelf", "broken cabinet", "cabinet repair", "countertop"],
    synonymsFr: ["armoire de cuisine", "vanité", "organisateur de garde-robe", "étagère intégrée", "unité de rangement", "garde-manger", "penderie", "placard", "tiroir", "porte d'armoire", "quincaillerie", "tablette", "armoire brisée", "comptoir"]
  },

  // C20 - STAIRS
  {
    code: "C2010",
    level: 3,
    parentCode: "C20",
    nameFr: "Escaliers intérieurs",
    nameEn: "Interior Stairs",
    descriptionFr: "Escaliers intérieurs en bois, métal ou béton",
    descriptionEn: "Interior stairs in wood, metal or concrete",
    typicalLifespan: 40,
    category: "Interiors",
    synonymsEn: ["staircase", "stairway", "steps", "treads", "risers", "stringers", "landing", "newel post", "spiral stair", "straight stair", "L-shaped stair", "U-shaped stair", "squeaky stairs", "loose step", "broken step"],
    synonymsFr: ["escalier", "marches", "contremarches", "giron", "limon", "palier", "poteau de départ", "escalier en colimaçon", "escalier droit", "escalier en L", "escalier en U", "marche qui craque", "marche branlante", "marche cassée"]
  },
  {
    code: "C2020",
    level: 3,
    parentCode: "C20",
    nameFr: "Escaliers extérieurs",
    nameEn: "Exterior Stairs",
    descriptionFr: "Escaliers extérieurs et escaliers de secours",
    descriptionEn: "Exterior stairs and fire escapes",
    typicalLifespan: 35,
    category: "Interiors",
    synonymsEn: ["fire escape", "outdoor steps", "porch steps", "deck stairs", "concrete steps", "metal stairs", "wooden steps", "front steps", "back steps", "emergency exit", "egress stair", "icy steps", "slippery stairs", "broken step", "rusted stairs"],
    synonymsFr: ["escalier de secours", "marches extérieures", "escalier de galerie", "escalier de terrasse", "marches en béton", "escalier métallique", "marches en bois", "escalier avant", "escalier arrière", "sortie de secours", "escalier glacé", "escalier glissant", "marche brisée", "escalier rouillé"]
  },
  {
    code: "C2030",
    level: 3,
    parentCode: "C20",
    nameFr: "Rampes et garde-corps",
    nameEn: "Railings and Guards",
    descriptionFr: "Systèmes de rampes et garde-corps",
    descriptionEn: "Railing and guard systems",
    typicalLifespan: 30,
    category: "Interiors",
    synonymsEn: ["handrail", "banister", "baluster", "spindle", "guardrail", "stair rail", "newel post", "glass railing", "cable railing", "metal railing", "wood railing", "loose railing", "wobbly handrail", "broken railing", "railing repair"],
    synonymsFr: ["main courante", "rampe", "balustrade", "balustre", "garde-corps", "poteau de départ", "rampe en verre", "rampe à câble", "rampe métallique", "rampe en bois", "rampe branlante", "rampe brisée", "réparation rampe", "barreau"]
  },

  // C30 - INTERIOR FINISHES
  {
    code: "C3010",
    level: 3,
    parentCode: "C30",
    nameFr: "Revêtements de sol",
    nameEn: "Floor Finishes",
    descriptionFr: "Tapis, carrelage, bois franc et autres revêtements",
    descriptionEn: "Carpet, tile, hardwood and other floor coverings",
    typicalLifespan: 15,
    category: "Interiors",
    synonymsEn: ["carpet", "hardwood", "laminate", "vinyl", "LVP", "LVT", "tile floor", "linoleum", "flooring", "floor finish", "refinish floor", "scratched floor", "stained carpet", "worn carpet", "cracked tile", "floor repair", "subfloor"],
    synonymsFr: ["tapis", "bois franc", "plancher flottant", "vinyle", "céramique", "linoléum", "plancher", "finition de plancher", "sablage de plancher", "plancher égratigné", "tapis taché", "tapis usé", "tuile fissurée", "réparation plancher", "sous-plancher", "prélart"]
  },
  {
    code: "C3020",
    level: 3,
    parentCode: "C30",
    nameFr: "Revêtements muraux",
    nameEn: "Wall Finishes",
    descriptionFr: "Peinture, papier peint et revêtements muraux",
    descriptionEn: "Paint, wallpaper and wall coverings",
    typicalLifespan: 10,
    category: "Interiors",
    synonymsEn: ["paint", "painting", "wallpaper", "wall covering", "primer", "latex paint", "oil paint", "texture", "knockdown", "orange peel", "smooth finish", "accent wall", "peeling paint", "chipped paint", "mold on wall", "water stain", "touch up"],
    synonymsFr: ["peinture", "papier peint", "revêtement mural", "apprêt", "peinture latex", "peinture à l'huile", "texture", "finition lisse", "mur accent", "peinture qui pèle", "peinture écaillée", "moisissure au mur", "tache d'eau", "retouche", "crépi"]
  },
  {
    code: "C3030",
    level: 3,
    parentCode: "C30",
    nameFr: "Revêtements de plafond",
    nameEn: "Ceiling Finishes",
    descriptionFr: "Plafonds suspendus, carreaux et finitions",
    descriptionEn: "Suspended ceilings, tiles and finishes",
    typicalLifespan: 20,
    category: "Interiors",
    synonymsEn: ["drop ceiling", "suspended ceiling", "ceiling tile", "acoustic tile", "t-bar ceiling", "drywall ceiling", "popcorn ceiling", "textured ceiling", "coffered ceiling", "tray ceiling", "water stain ceiling", "sagging ceiling", "ceiling repair", "ceiling crack"],
    synonymsFr: ["plafond suspendu", "tuile de plafond", "tuile acoustique", "plafond de gypse", "plafond texturé", "plafond à caissons", "tache d'eau au plafond", "plafond affaissé", "réparation plafond", "fissure au plafond", "plafond de béton", "faux plafond"]
  },
  {
    code: "C3040",
    level: 3,
    parentCode: "C30",
    nameFr: "Carrelage et céramique",
    nameEn: "Tile and Ceramic",
    descriptionFr: "Carrelage céramique et revêtements spécialisés",
    descriptionEn: "Ceramic tile and specialized coverings",
    typicalLifespan: 25,
    category: "Interiors",
    synonymsEn: ["ceramic tile", "porcelain tile", "mosaic", "subway tile", "backsplash", "grout", "tile grout", "caulk", "floor tile", "wall tile", "shower tile", "cracked tile", "loose tile", "grout repair", "regrout", "tile repair"],
    synonymsFr: ["céramique", "porcelaine", "mosaïque", "tuile métro", "dosseret", "coulis", "calfeutrant", "tuile de plancher", "tuile murale", "tuile de douche", "tuile fissurée", "tuile décollée", "réparation coulis", "rejointoiement", "réparation tuile"]
  },

  // D10 - CONVEYING
  {
    code: "D1010",
    level: 3,
    parentCode: "D10",
    nameFr: "Ascenseurs électriques",
    nameEn: "Electric Elevators",
    descriptionFr: "Ascenseurs électriques pour passagers",
    descriptionEn: "Electric passenger elevators",
    typicalLifespan: 25,
    category: "Services",
    synonymsEn: ["elevator", "lift", "passenger elevator", "traction elevator", "gearless elevator", "machine room", "elevator cab", "elevator door", "elevator button", "elevator stuck", "elevator repair", "elevator inspection", "elevator modernization"],
    synonymsFr: ["ascenseur", "ascenseur électrique", "ascenseur à traction", "cabine d'ascenseur", "porte d'ascenseur", "bouton d'ascenseur", "ascenseur bloqué", "réparation ascenseur", "inspection ascenseur", "modernisation ascenseur", "monte-charge"]
  },
  {
    code: "D1020",
    level: 3,
    parentCode: "D10",
    nameFr: "Ascenseurs hydrauliques",
    nameEn: "Hydraulic Elevators",
    descriptionFr: "Ascenseurs hydrauliques pour faible hauteur",
    descriptionEn: "Hydraulic elevators for low-rise buildings",
    typicalLifespan: 20,
    category: "Services",
    synonymsEn: ["hydraulic lift", "low-rise elevator", "jack elevator", "plunger elevator", "elevator pit", "hydraulic cylinder", "elevator oil", "oil leak", "elevator slow", "elevator jerky", "wheelchair lift", "platform lift"],
    synonymsFr: ["ascenseur hydraulique", "élévateur", "vérin hydraulique", "cylindre hydraulique", "huile d'ascenseur", "fuite d'huile", "ascenseur lent", "monte-personne", "plateforme élévatrice", "élévateur pour fauteuil roulant"]
  },
  {
    code: "D1030",
    level: 3,
    parentCode: "D10",
    nameFr: "Escaliers mécaniques",
    nameEn: "Escalators",
    descriptionFr: "Escaliers mécaniques et trottoirs roulants",
    descriptionEn: "Escalators and moving walkways",
    typicalLifespan: 25,
    category: "Services",
    synonymsEn: ["moving stairs", "escalator step", "escalator handrail", "moving walkway", "people mover", "travolator", "escalator repair", "escalator stopped", "escalator maintenance", "escalator inspection"],
    synonymsFr: ["escalier mécanique", "escalier roulant", "marche d'escalier mécanique", "main courante", "trottoir roulant", "tapis roulant", "réparation escalier mécanique", "escalier mécanique arrêté", "entretien escalier mécanique"]
  },

  // D20 - PLUMBING
  {
    code: "D2010",
    level: 3,
    parentCode: "D20",
    nameFr: "Alimentation en eau",
    nameEn: "Water Supply",
    descriptionFr: "Systèmes d'alimentation et distribution d'eau",
    descriptionEn: "Water supply and distribution systems",
    typicalLifespan: 40,
    category: "Services",
    synonymsEn: ["water pipe", "supply line", "copper pipe", "PEX", "water main", "shut-off valve", "water pressure", "low pressure", "no water", "frozen pipe", "burst pipe", "pipe leak", "water meter", "backflow preventer", "PRV"],
    synonymsFr: ["tuyau d'eau", "conduite d'eau", "tuyau de cuivre", "PEX", "entrée d'eau", "valve d'arrêt", "pression d'eau", "basse pression", "pas d'eau", "tuyau gelé", "tuyau éclaté", "fuite de tuyau", "compteur d'eau", "clapet antiretour"]
  },
  {
    code: "D2020",
    level: 3,
    parentCode: "D20",
    nameFr: "Évacuation des eaux",
    nameEn: "Waste Water",
    descriptionFr: "Systèmes d'évacuation des eaux usées",
    descriptionEn: "Waste water and sewage systems",
    typicalLifespan: 40,
    category: "Services",
    synonymsEn: ["drain pipe", "sewer line", "waste pipe", "vent pipe", "drain clog", "clogged drain", "slow drain", "backup", "sewage backup", "sewer smell", "drain snake", "rooter", "cleanout", "p-trap", "septic"],
    synonymsFr: ["tuyau de drainage", "égout", "tuyau d'évacuation", "évent", "drain bouché", "drainage lent", "refoulement", "odeur d'égout", "débouchage", "fosse septique", "siphon", "renvoi", "colonne de plomberie"]
  },
  {
    code: "D2030",
    level: 3,
    parentCode: "D20",
    nameFr: "Équipements sanitaires",
    nameEn: "Plumbing Fixtures",
    descriptionFr: "Éviers, toilettes, douches et baignoires",
    descriptionEn: "Sinks, toilets, showers and bathtubs",
    typicalLifespan: 20,
    category: "Services",
    synonymsEn: ["toilet", "sink", "faucet", "shower", "bathtub", "tub", "bidet", "urinal", "lavatory", "vanity", "running toilet", "leaky faucet", "clogged toilet", "dripping tap", "shower head", "drain stopper"],
    synonymsFr: ["toilette", "évier", "robinet", "douche", "baignoire", "bain", "bidet", "urinoir", "lavabo", "vanité", "toilette qui coule", "robinet qui fuit", "toilette bouchée", "pommeau de douche", "bouchon de drain", "robinetterie"]
  },
  {
    code: "D2040",
    level: 3,
    parentCode: "D20",
    nameFr: "Chauffe-eau",
    nameEn: "Water Heaters",
    descriptionFr: "Chauffe-eau domestiques et commerciaux",
    descriptionEn: "Domestic and commercial water heaters",
    typicalLifespan: 12,
    category: "Services",
    synonymsEn: ["hot water tank", "water heater", "tankless", "on-demand", "electric water heater", "gas water heater", "no hot water", "water too hot", "pilot light", "anode rod", "water heater leak", "sediment", "expansion tank"],
    synonymsFr: ["chauffe-eau", "réservoir d'eau chaude", "chauffe-eau instantané", "chauffe-eau électrique", "chauffe-eau au gaz", "pas d'eau chaude", "eau trop chaude", "veilleuse", "anode", "fuite chauffe-eau", "réservoir d'expansion", "sédiments"]
  },
  {
    code: "D2050",
    level: 3,
    parentCode: "D20",
    nameFr: "Systèmes de traitement d'eau",
    nameEn: "Water Treatment Systems",
    descriptionFr: "Filtration et traitement de l'eau",
    descriptionEn: "Water filtration and treatment systems",
    typicalLifespan: 15,
    category: "Services",
    synonymsEn: ["water filter", "water softener", "filtration", "reverse osmosis", "RO system", "UV filter", "carbon filter", "sediment filter", "hard water", "water purifier", "water quality", "iron filter", "chlorine filter"],
    synonymsFr: ["filtre à eau", "adoucisseur d'eau", "filtration", "osmose inversée", "système RO", "filtre UV", "filtre à charbon", "filtre à sédiments", "eau dure", "purificateur d'eau", "qualité de l'eau", "filtre à fer"]
  },

  // D30 - HVAC
  {
    code: "D3010",
    level: 3,
    parentCode: "D30",
    nameFr: "Systèmes de chauffage",
    nameEn: "Heating Systems",
    descriptionFr: "Chaudières, thermopompes et systèmes de chauffage",
    descriptionEn: "Boilers, heat pumps and heating systems",
    typicalLifespan: 20,
    category: "Services",
    synonymsEn: ["furnace", "boiler", "heat pump", "heater", "heating", "forced air", "radiant heat", "baseboard", "radiator", "no heat", "cold room", "furnace repair", "pilot light", "thermostat", "gas furnace", "electric heat", "oil furnace"],
    synonymsFr: ["fournaise", "chaudière", "thermopompe", "chauffage", "plinthe électrique", "radiateur", "chauffage radiant", "plancher chauffant", "pas de chauffage", "pièce froide", "réparation fournaise", "thermostat", "chauffage au gaz", "chauffage électrique", "chauffage au mazout"]
  },
  {
    code: "D3020",
    level: 3,
    parentCode: "D30",
    nameFr: "Systèmes de ventilation",
    nameEn: "Ventilation Systems",
    descriptionFr: "Ventilateurs et systèmes de ventilation mécanique",
    descriptionEn: "Fans and mechanical ventilation systems",
    typicalLifespan: 20,
    category: "Services",
    synonymsEn: ["ventilation", "exhaust fan", "bathroom fan", "kitchen fan", "range hood", "HRV", "ERV", "fresh air", "make-up air", "rooftop unit", "RTU", "air handler", "AHU", "stuffy air", "poor ventilation", "musty smell"],
    synonymsFr: ["ventilation", "ventilateur", "ventilateur de salle de bain", "hotte de cuisine", "VRC", "VRE", "air frais", "air d'appoint", "unité de toit", "centrale de traitement d'air", "air vicié", "mauvaise ventilation", "odeur de moisi", "extracteur"]
  },
  {
    code: "D3030",
    level: 3,
    parentCode: "D30",
    nameFr: "Systèmes de climatisation",
    nameEn: "Air Conditioning Systems",
    descriptionFr: "Unités de climatisation et refroidissement",
    descriptionEn: "Air conditioning and cooling units",
    typicalLifespan: 15,
    category: "Services",
    synonymsEn: ["AC", "air conditioning", "air conditioner", "A/C", "cooling", "central air", "split system", "mini split", "window unit", "PTAC", "chiller", "cooling tower", "no cool air", "AC not working", "frozen coil", "refrigerant", "freon"],
    synonymsFr: ["climatisation", "climatiseur", "air climatisé", "AC", "refroidissement", "air central", "thermopompe murale", "unité de fenêtre", "refroidisseur", "pas d'air froid", "climatiseur ne fonctionne pas", "serpentin gelé", "réfrigérant", "fréon"]
  },
  {
    code: "D3040",
    level: 3,
    parentCode: "D30",
    nameFr: "Conduits et distribution",
    nameEn: "Ductwork and Distribution",
    descriptionFr: "Réseaux de conduits d'air et distribution",
    descriptionEn: "Air duct networks and distribution",
    typicalLifespan: 25,
    category: "Services",
    synonymsEn: ["ductwork", "ducts", "air duct", "flex duct", "sheet metal", "supply duct", "return duct", "register", "grille", "diffuser", "duct cleaning", "leaky duct", "duct insulation", "damper", "duct tape"],
    synonymsFr: ["conduits", "gaines", "conduit d'air", "conduit flexible", "tôle", "conduit d'alimentation", "conduit de retour", "registre", "grille", "diffuseur", "nettoyage de conduits", "conduit qui fuit", "isolation de conduit", "volet"]
  },
  {
    code: "D3050",
    level: 3,
    parentCode: "D30",
    nameFr: "Contrôles automatiques",
    nameEn: "Automatic Controls",
    descriptionFr: "Systèmes de contrôle automatique CVC",
    descriptionEn: "HVAC automatic control systems",
    typicalLifespan: 15,
    category: "Services",
    synonymsEn: ["thermostat", "smart thermostat", "programmable thermostat", "BAS", "building automation", "DDC", "sensor", "temperature control", "zone control", "setpoint", "nest", "ecobee", "honeywell"],
    synonymsFr: ["thermostat", "thermostat intelligent", "thermostat programmable", "automatisation du bâtiment", "capteur", "contrôle de température", "contrôle de zone", "point de consigne", "système de gestion", "régulation"]
  },

  // D40 - FIRE PROTECTION
  {
    code: "D4010",
    level: 3,
    parentCode: "D40",
    nameFr: "Systèmes de gicleurs",
    nameEn: "Sprinkler Systems",
    descriptionFr: "Systèmes de gicleurs automatiques",
    descriptionEn: "Automatic sprinkler systems",
    typicalLifespan: 30,
    category: "Services",
    synonymsEn: ["sprinkler", "fire sprinkler", "sprinkler head", "wet system", "dry system", "standpipe", "fire main", "sprinkler valve", "flow switch", "tamper switch", "sprinkler inspection", "sprinkler leak", "corroded sprinkler"],
    synonymsFr: ["gicleur", "gicleur automatique", "tête de gicleur", "système humide", "système sec", "colonne montante", "conduite principale", "valve de gicleur", "inspection gicleur", "fuite de gicleur", "gicleur corrodé", "extincteur automatique"]
  },
  {
    code: "D4020",
    level: 3,
    parentCode: "D40",
    nameFr: "Détection d'incendie",
    nameEn: "Fire Detection",
    descriptionFr: "Systèmes de détection de fumée et incendie",
    descriptionEn: "Smoke and fire detection systems",
    typicalLifespan: 15,
    category: "Services",
    synonymsEn: ["smoke detector", "smoke alarm", "heat detector", "fire detector", "carbon monoxide", "CO detector", "combination detector", "photoelectric", "ionization", "beeping alarm", "false alarm", "detector battery", "hardwired detector"],
    synonymsFr: ["détecteur de fumée", "avertisseur de fumée", "détecteur de chaleur", "détecteur d'incendie", "monoxyde de carbone", "détecteur CO", "détecteur combiné", "alarme qui bip", "fausse alarme", "pile de détecteur", "détecteur câblé"]
  },
  {
    code: "D4030",
    level: 3,
    parentCode: "D40",
    nameFr: "Systèmes d'alarme",
    nameEn: "Alarm Systems",
    descriptionFr: "Systèmes d'alarme incendie et évacuation",
    descriptionEn: "Fire alarm and evacuation systems",
    typicalLifespan: 15,
    category: "Services",
    synonymsEn: ["fire alarm", "alarm panel", "pull station", "horn", "strobe", "annunciator", "fire alarm test", "alarm monitoring", "central station", "trouble signal", "supervisory signal", "evacuation alarm"],
    synonymsFr: ["alarme incendie", "panneau d'alarme", "station manuelle", "avertisseur sonore", "stroboscope", "annonciateur", "test d'alarme", "surveillance d'alarme", "centrale de surveillance", "signal de dérangement", "alarme d'évacuation"]
  },
  {
    code: "D4040",
    level: 3,
    parentCode: "D40",
    nameFr: "Extinction spécialisée",
    nameEn: "Special Suppression",
    descriptionFr: "Systèmes d'extinction spécialisés (gaz, mousse)",
    descriptionEn: "Special suppression systems (gas, foam)",
    typicalLifespan: 20,
    category: "Services",
    synonymsEn: ["fire extinguisher", "extinguisher", "FM200", "clean agent", "halon", "foam system", "CO2 system", "kitchen hood suppression", "dry chemical", "wet chemical", "fire blanket", "extinguisher inspection", "extinguisher recharge"],
    synonymsFr: ["extincteur", "FM200", "agent propre", "halon", "système de mousse", "système CO2", "suppression de hotte", "poudre chimique", "inspection extincteur", "recharge extincteur", "couverture anti-feu"]
  },

  // D50 - ELECTRICAL
  {
    code: "D5010",
    level: 3,
    parentCode: "D50",
    nameFr: "Distribution électrique",
    nameEn: "Electrical Distribution",
    descriptionFr: "Panneaux électriques et distribution principale",
    descriptionEn: "Electrical panels and main distribution",
    typicalLifespan: 30,
    category: "Services",
    synonymsEn: ["electrical panel", "breaker box", "circuit breaker", "fuse box", "main panel", "sub panel", "transformer", "meter", "service entrance", "tripped breaker", "power outage", "no power", "electrical upgrade", "200 amp", "100 amp"],
    synonymsFr: ["panneau électrique", "boîte de disjoncteurs", "disjoncteur", "boîte à fusibles", "panneau principal", "sous-panneau", "transformateur", "compteur", "entrée électrique", "disjoncteur déclenché", "panne de courant", "pas de courant", "mise à niveau électrique"]
  },
  {
    code: "D5020",
    level: 3,
    parentCode: "D50",
    nameFr: "Éclairage intérieur",
    nameEn: "Interior Lighting",
    descriptionFr: "Luminaires et systèmes d'éclairage intérieur",
    descriptionEn: "Interior lighting fixtures and systems",
    typicalLifespan: 15,
    category: "Services",
    synonymsEn: ["light fixture", "lighting", "ceiling light", "recessed light", "pot light", "chandelier", "pendant light", "LED", "fluorescent", "bulb", "lamp", "dimmer", "light switch", "flickering light", "burnt out bulb", "ballast"],
    synonymsFr: ["luminaire", "éclairage", "plafonnier", "lumière encastrée", "spot", "lustre", "suspension", "DEL", "fluorescent", "ampoule", "lampe", "gradateur", "interrupteur", "lumière qui clignote", "ampoule brûlée", "ballast"]
  },
  {
    code: "D5030",
    level: 3,
    parentCode: "D50",
    nameFr: "Éclairage extérieur",
    nameEn: "Exterior Lighting",
    descriptionFr: "Éclairage extérieur et de sécurité",
    descriptionEn: "Exterior and security lighting",
    typicalLifespan: 15,
    category: "Services",
    synonymsEn: ["outdoor lighting", "parking lot light", "pole light", "wall pack", "flood light", "security light", "motion light", "pathway light", "landscape light", "exit sign", "emergency light", "photocell", "timer"],
    synonymsFr: ["éclairage extérieur", "lampadaire", "luminaire de stationnement", "projecteur", "lumière de sécurité", "lumière à détecteur", "lumière de sentier", "éclairage paysager", "sortie de secours", "éclairage d'urgence", "photocellule", "minuterie"]
  },
  {
    code: "D5040",
    level: 3,
    parentCode: "D50",
    nameFr: "Prises et circuits",
    nameEn: "Outlets and Circuits",
    descriptionFr: "Prises électriques et circuits de distribution",
    descriptionEn: "Electrical outlets and distribution circuits",
    typicalLifespan: 30,
    category: "Services",
    synonymsEn: ["outlet", "receptacle", "plug", "electrical outlet", "GFCI", "GFI", "dead outlet", "no power outlet", "sparking outlet", "burnt outlet", "outlet cover", "junction box", "wiring", "wire", "circuit"],
    synonymsFr: ["prise", "prise électrique", "prise de courant", "DDFT", "prise morte", "prise sans courant", "prise qui fait des étincelles", "prise brûlée", "couvercle de prise", "boîte de jonction", "câblage", "fil", "circuit"]
  },
  {
    code: "D5050",
    level: 3,
    parentCode: "D50",
    nameFr: "Systèmes de communication",
    nameEn: "Communication Systems",
    descriptionFr: "Téléphonie, internet et systèmes de communication",
    descriptionEn: "Telephone, internet and communication systems",
    typicalLifespan: 10,
    category: "Services",
    synonymsEn: ["phone", "telephone", "internet", "data", "cable", "fiber optic", "ethernet", "network", "wifi", "router", "intercom", "buzzer", "doorbell", "CAT5", "CAT6", "patch panel", "no internet"],
    synonymsFr: ["téléphone", "internet", "données", "câble", "fibre optique", "ethernet", "réseau", "wifi", "routeur", "interphone", "sonnette", "pas d'internet", "panneau de brassage", "câblage réseau"]
  },
  {
    code: "D5060",
    level: 3,
    parentCode: "D50",
    nameFr: "Systèmes de sécurité",
    nameEn: "Security Systems",
    descriptionFr: "Caméras, contrôle d'accès et sécurité électronique",
    descriptionEn: "Cameras, access control and electronic security",
    typicalLifespan: 10,
    category: "Services",
    synonymsEn: ["security camera", "CCTV", "surveillance", "access control", "key fob", "card reader", "keypad", "alarm", "motion sensor", "door contact", "security system", "DVR", "NVR", "camera not working", "broken camera"],
    synonymsFr: ["caméra de sécurité", "vidéosurveillance", "contrôle d'accès", "porte-clés", "lecteur de carte", "clavier", "alarme", "détecteur de mouvement", "contact de porte", "système de sécurité", "caméra brisée", "enregistreur"]
  },

  // E10 - EQUIPMENT
  {
    code: "E1010",
    level: 3,
    parentCode: "E10",
    nameFr: "Équipements de cuisine",
    nameEn: "Kitchen Equipment",
    descriptionFr: "Appareils électroménagers et équipements de cuisine",
    descriptionEn: "Appliances and kitchen equipment",
    typicalLifespan: 12,
    category: "Equipment & Furnishings",
    synonymsEn: ["appliance", "stove", "oven", "range", "refrigerator", "fridge", "freezer", "dishwasher", "microwave", "garbage disposal", "garburator", "range hood", "exhaust fan", "broken appliance", "appliance repair"],
    synonymsFr: ["électroménager", "cuisinière", "four", "réfrigérateur", "frigo", "congélateur", "lave-vaisselle", "micro-ondes", "broyeur", "hotte de cuisine", "ventilateur", "appareil brisé", "réparation électroménager", "poêle"]
  },
  {
    code: "E1020",
    level: 3,
    parentCode: "E10",
    nameFr: "Équipements de buanderie",
    nameEn: "Laundry Equipment",
    descriptionFr: "Laveuses, sécheuses et équipements de buanderie",
    descriptionEn: "Washers, dryers and laundry equipment",
    typicalLifespan: 10,
    category: "Equipment & Furnishings",
    synonymsEn: ["washer", "washing machine", "dryer", "laundry", "front load", "top load", "stackable", "coin operated", "dryer vent", "lint trap", "washer leak", "dryer not heating", "spin cycle", "agitator"],
    synonymsFr: ["laveuse", "machine à laver", "sécheuse", "buanderie", "chargement frontal", "chargement par le haut", "superposable", "à monnaie", "conduit de sécheuse", "filtre à charpie", "fuite de laveuse", "sécheuse ne chauffe pas"]
  },
  {
    code: "E1030",
    level: 3,
    parentCode: "E10",
    nameFr: "Équipements de maintenance",
    nameEn: "Maintenance Equipment",
    descriptionFr: "Équipements de nettoyage et maintenance du bâtiment",
    descriptionEn: "Building cleaning and maintenance equipment",
    typicalLifespan: 15,
    category: "Equipment & Furnishings",
    synonymsEn: ["vacuum", "floor buffer", "floor scrubber", "pressure washer", "power washer", "carpet cleaner", "snow blower", "leaf blower", "lawn mower", "maintenance tools", "cleaning equipment", "janitorial"],
    synonymsFr: ["aspirateur", "polisseuse", "auto-laveuse", "laveuse à pression", "nettoyeur de tapis", "souffleuse à neige", "souffleur à feuilles", "tondeuse", "outils de maintenance", "équipement de nettoyage", "concierge"]
  },

  // E20 - FURNISHINGS
  {
    code: "E2010",
    level: 3,
    parentCode: "E20",
    nameFr: "Ameublement fixe",
    nameEn: "Fixed Furnishings",
    descriptionFr: "Mobilier intégré et ameublement fixe",
    descriptionEn: "Built-in furniture and fixed furnishings",
    typicalLifespan: 15,
    category: "Equipment & Furnishings",
    synonymsEn: ["built-in furniture", "bench", "seating", "counter", "reception desk", "millwork", "custom cabinet", "shelving unit", "display case", "wardrobe", "murphy bed", "window seat", "banquette"],
    synonymsFr: ["mobilier intégré", "banc", "siège", "comptoir", "bureau de réception", "menuiserie", "armoire sur mesure", "étagère", "vitrine", "penderie", "lit escamotable", "banquette", "siège de fenêtre"]
  },
  {
    code: "E2020",
    level: 3,
    parentCode: "E20",
    nameFr: "Stores et habillage fenêtres",
    nameEn: "Window Treatments",
    descriptionFr: "Stores, rideaux et habillage de fenêtres",
    descriptionEn: "Blinds, curtains and window treatments",
    typicalLifespan: 10,
    category: "Equipment & Furnishings",
    synonymsEn: ["blinds", "curtains", "drapes", "shades", "shutters", "roller shade", "venetian blind", "vertical blind", "blackout", "sheer", "curtain rod", "broken blind", "stuck blind", "window covering"],
    synonymsFr: ["stores", "rideaux", "tentures", "volets", "store enrouleur", "store vénitien", "store vertical", "occultant", "voilage", "tringle", "store brisé", "store coincé", "habillage de fenêtre", "toile"]
  },

  // F10 - SPECIAL CONSTRUCTION
  {
    code: "F1010",
    level: 3,
    parentCode: "F10",
    nameFr: "Structures préfabriquées",
    nameEn: "Prefabricated Structures",
    descriptionFr: "Éléments et structures préfabriquées",
    descriptionEn: "Prefabricated elements and structures",
    typicalLifespan: 40,
    category: "Special Construction & Demolition",
    synonymsEn: ["prefab", "modular", "precast", "prefabricated building", "portable building", "storage shed", "garage kit", "carport", "gazebo", "pergola", "greenhouse", "pool house", "modular unit"],
    synonymsFr: ["préfabriqué", "modulaire", "préfab", "bâtiment préfabriqué", "cabanon", "abri de jardin", "garage préfab", "abri d'auto", "gazebo", "pergola", "serre", "maison de piscine", "unité modulaire"]
  },
  {
    code: "F1020",
    level: 3,
    parentCode: "F10",
    nameFr: "Constructions spécialisées",
    nameEn: "Specialized Construction",
    descriptionFr: "Éléments de construction spécialisés",
    descriptionEn: "Specialized construction elements",
    typicalLifespan: 30,
    category: "Special Construction & Demolition",
    synonymsEn: ["clean room", "cold storage", "vault", "safe room", "soundproof room", "recording studio", "darkroom", "wine cellar", "indoor pool", "sauna", "steam room", "hot tub enclosure"],
    synonymsFr: ["salle blanche", "chambre froide", "chambre forte", "salle sécurisée", "insonorisation", "studio d'enregistrement", "chambre noire", "cave à vin", "piscine intérieure", "sauna", "hammam", "spa"]
  },

  // F20 - SELECTIVE DEMOLITION
  {
    code: "F2010",
    level: 3,
    parentCode: "F20",
    nameFr: "Démolition intérieure",
    nameEn: "Interior Demolition",
    descriptionFr: "Démolition sélective d'éléments intérieurs",
    descriptionEn: "Selective demolition of interior elements",
    category: "Special Construction & Demolition",
    synonymsEn: ["demo", "demolition", "tear out", "gut", "strip out", "remove wall", "remove ceiling", "remove floor", "asbestos removal", "lead paint removal", "hazmat", "renovation demo"],
    synonymsFr: ["démolition", "démantèlement", "arrachage", "dépose", "retirer mur", "retirer plafond", "retirer plancher", "retrait amiante", "retrait peinture au plomb", "décontamination", "démolition rénovation"]
  },
  {
    code: "F2020",
    level: 3,
    parentCode: "F20",
    nameFr: "Démolition extérieure",
    nameEn: "Exterior Demolition",
    descriptionFr: "Démolition sélective d'éléments extérieurs",
    descriptionEn: "Selective demolition of exterior elements",
    category: "Special Construction & Demolition",
    synonymsEn: ["exterior demo", "remove siding", "remove roofing", "remove deck", "remove concrete", "remove asphalt", "remove fence", "structure removal", "building demolition", "wrecking"],
    synonymsFr: ["démolition extérieure", "retirer revêtement", "retirer toiture", "retirer terrasse", "retirer béton", "retirer asphalte", "retirer clôture", "démolition structure", "démolition bâtiment"]
  },

  // G10 - SITE PREPARATION
  {
    code: "G1010",
    level: 3,
    parentCode: "G10",
    nameFr: "Déblaiement du site",
    nameEn: "Site Clearing",
    descriptionFr: "Déblaiement et préparation initiale du terrain",
    descriptionEn: "Site clearing and initial preparation",
    category: "Building Sitework",
    synonymsEn: ["clearing", "grubbing", "tree removal", "stump removal", "brush clearing", "land clearing", "lot clearing", "vegetation removal", "site prep", "ground preparation"],
    synonymsFr: ["déblaiement", "défrichage", "abattage d'arbres", "dessouchage", "débroussaillage", "préparation du terrain", "nettoyage du lot", "enlèvement de végétation", "préparation du site"]
  },
  {
    code: "G1020",
    level: 3,
    parentCode: "G10",
    nameFr: "Excavation",
    nameEn: "Excavation",
    descriptionFr: "Travaux d'excavation et terrassement",
    descriptionEn: "Excavation and earthwork",
    category: "Building Sitework",
    synonymsEn: ["digging", "trenching", "grading", "earthwork", "backfill", "compaction", "cut and fill", "soil removal", "foundation excavation", "utility trench", "basement dig"],
    synonymsFr: ["excavation", "creusage", "tranchée", "terrassement", "remblai", "compactage", "nivellement", "enlèvement de sol", "creusage de fondation", "tranchée utilitaire"]
  },

  // G20 - SITE IMPROVEMENTS
  {
    code: "G2010",
    level: 3,
    parentCode: "G20",
    nameFr: "Aménagement paysager",
    nameEn: "Landscaping",
    descriptionFr: "Plantation et aménagement paysager",
    descriptionEn: "Planting and landscaping",
    typicalLifespan: 15,
    category: "Building Sitework",
    synonymsEn: ["lawn", "grass", "sod", "garden", "planting", "trees", "shrubs", "flower bed", "mulch", "irrigation", "sprinkler system", "lawn care", "yard maintenance", "dead grass", "overgrown"],
    synonymsFr: ["pelouse", "gazon", "tourbe", "jardin", "plantation", "arbres", "arbustes", "plate-bande", "paillis", "irrigation", "système d'arrosage", "entretien de pelouse", "entretien de cour", "gazon mort"]
  },
  {
    code: "G2020",
    level: 3,
    parentCode: "G20",
    nameFr: "Pavage et allées",
    nameEn: "Paving and Walkways",
    descriptionFr: "Stationnements, allées et surfaces pavées",
    descriptionEn: "Parking, walkways and paved surfaces",
    typicalLifespan: 25,
    category: "Building Sitework",
    synonymsEn: ["parking lot", "asphalt", "concrete", "pavement", "sidewalk", "walkway", "driveway", "curb", "pothole", "crack sealing", "line painting", "striping", "parking space", "resurfacing", "sealcoat"],
    synonymsFr: ["stationnement", "asphalte", "béton", "pavé", "trottoir", "allée", "entrée de garage", "bordure", "nid-de-poule", "fissure", "lignage", "marquage", "place de stationnement", "resurfaçage", "scellant"]
  },
  {
    code: "G2030",
    level: 3,
    parentCode: "G20",
    nameFr: "Clôtures et portails",
    nameEn: "Fencing and Gates",
    descriptionFr: "Clôtures, portails et délimitations",
    descriptionEn: "Fences, gates and boundaries",
    typicalLifespan: 20,
    category: "Building Sitework",
    synonymsEn: ["fence", "gate", "chain link", "wood fence", "vinyl fence", "iron fence", "privacy fence", "security fence", "gate operator", "automatic gate", "fence post", "broken fence", "leaning fence", "fence repair"],
    synonymsFr: ["clôture", "portail", "grillage", "clôture en bois", "clôture en PVC", "clôture en fer", "clôture de intimité", "clôture de sécurité", "barrière automatique", "poteau de clôture", "clôture brisée", "clôture penchée", "réparation clôture"]
  },

  // G30 - SITE MECHANICAL UTILITIES
  {
    code: "G3010",
    level: 3,
    parentCode: "G30",
    nameFr: "Distribution d'eau du site",
    nameEn: "Site Water Distribution",
    descriptionFr: "Réseaux de distribution d'eau sur le site",
    descriptionEn: "Site water distribution networks",
    typicalLifespan: 40,
    category: "Building Sitework",
    synonymsEn: ["water main", "water line", "fire hydrant", "water meter pit", "gate valve", "water service", "underground pipe", "water leak", "broken water main", "water pressure", "municipal water"],
    synonymsFr: ["conduite d'eau principale", "conduite d'eau", "borne-fontaine", "puisard de compteur", "vanne", "service d'eau", "tuyau souterrain", "fuite d'eau", "bris de conduite", "pression d'eau", "eau municipale"]
  },
  {
    code: "G3020",
    level: 3,
    parentCode: "G30",
    nameFr: "Évacuation des eaux du site",
    nameEn: "Site Sewerage",
    descriptionFr: "Systèmes d'évacuation des eaux usées du site",
    descriptionEn: "Site sewerage and waste water systems",
    typicalLifespan: 40,
    category: "Building Sitework",
    synonymsEn: ["sewer line", "sewer main", "sanitary sewer", "sewer lateral", "manhole", "cleanout", "sewer backup", "clogged sewer", "root intrusion", "sewer repair", "sewer camera", "septic tank", "septic field"],
    synonymsFr: ["égout", "conduite d'égout", "égout sanitaire", "branchement d'égout", "regard", "nettoyage", "refoulement d'égout", "égout bouché", "racines dans l'égout", "réparation égout", "fosse septique", "champ d'épuration"]
  },
  {
    code: "G3030",
    level: 3,
    parentCode: "G30",
    nameFr: "Drainage pluvial",
    nameEn: "Storm Drainage",
    descriptionFr: "Systèmes de drainage des eaux pluviales",
    descriptionEn: "Storm water drainage systems",
    typicalLifespan: 30,
    category: "Building Sitework",
    synonymsEn: ["storm drain", "catch basin", "storm sewer", "culvert", "french drain", "swale", "retention pond", "detention basin", "yard drain", "flooding", "standing water", "drainage problem", "grading issue"],
    synonymsFr: ["drain pluvial", "puisard", "égout pluvial", "ponceau", "drain français", "fossé", "bassin de rétention", "drain de cour", "inondation", "eau stagnante", "problème de drainage", "problème de nivellement"]
  },

  // G40 - SITE ELECTRICAL UTILITIES
  {
    code: "G4010",
    level: 3,
    parentCode: "G40",
    nameFr: "Distribution électrique du site",
    nameEn: "Site Electrical Distribution",
    descriptionFr: "Distribution électrique principale du site",
    descriptionEn: "Site main electrical distribution",
    typicalLifespan: 30,
    category: "Building Sitework",
    synonymsEn: ["power line", "underground electrical", "transformer", "utility pole", "meter base", "service disconnect", "electrical conduit", "power outage", "underground cable", "utility connection"],
    synonymsFr: ["ligne électrique", "électricité souterraine", "transformateur", "poteau électrique", "base de compteur", "déconnexion de service", "conduit électrique", "panne de courant", "câble souterrain", "branchement utilitaire"]
  },
  {
    code: "G4020",
    level: 3,
    parentCode: "G40",
    nameFr: "Éclairage du site",
    nameEn: "Site Lighting",
    descriptionFr: "Éclairage extérieur du site et des voies d'accès",
    descriptionEn: "Exterior site and access lighting",
    typicalLifespan: 15,
    category: "Building Sitework",
    synonymsEn: ["parking lot lighting", "pole light", "street light", "pathway lighting", "bollard light", "flood light", "security lighting", "LED conversion", "light pole", "burnt out light", "dark parking lot"],
    synonymsFr: ["éclairage de stationnement", "lampadaire", "éclairage de rue", "éclairage de sentier", "borne lumineuse", "projecteur", "éclairage de sécurité", "conversion DEL", "poteau d'éclairage", "lumière brûlée", "stationnement sombre"]
  },
  {
    code: "G4030",
    level: 3,
    parentCode: "G40",
    nameFr: "Communications du site",
    nameEn: "Site Communications",
    descriptionFr: "Réseaux de télécommunications du site",
    descriptionEn: "Site telecommunications networks",
    typicalLifespan: 15,
    category: "Building Sitework",
    synonymsEn: ["underground telecom", "fiber optic", "cable TV", "telephone line", "data line", "communication conduit", "utility pedestal", "junction box", "handhole", "cable damage", "no phone service"],
    synonymsFr: ["télécom souterrain", "fibre optique", "câblodistribution", "ligne téléphonique", "ligne de données", "conduit de communication", "piédestal utilitaire", "boîte de jonction", "regard de tirage", "câble endommagé", "pas de service téléphonique"]
  },
];
