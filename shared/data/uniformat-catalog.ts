/**
 * UNIFORMAT II Catalog for Quebec Construction Standards
 * 
 * This catalog provides comprehensive UNIFORMAT Level 4 building element data
 * specifically tailored for Quebec construction conditions, including:
 * - French and English terminology using Quebec construction vocabulary
 * - Typical lifespans adjusted for Quebec climate (harsh winters, freeze-thaw cycles)
 * - Common Quebec building elements (flat roofs, cold climate exterior systems, etc.)
 * - Complete hierarchical structure from Level 1 to Level 4
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

  // LEVEL 3 - SUB-GROUP ELEMENTS
  // A10 - FOUNDATIONS
  {
    code: "A101",
    level: 3,
    parentCode: "A10",
    nameFr: "Fondations standard",
    nameEn: "Standard Foundations",
    descriptionFr: "Fondations en béton coulé sur place et préfabriquées",
    descriptionEn: "Cast-in-place and precast concrete foundations",
    category: "Substructure"
  },
  {
    code: "A102",
    level: 3,
    parentCode: "A10",
    nameFr: "Fondations spéciales",
    nameEn: "Special Foundations",
    descriptionFr: "Pieux, caissons et fondations spécialisées",
    descriptionEn: "Piles, caissons and specialized foundations",
    category: "Substructure"
  },

  // A20 - BASEMENT CONSTRUCTION
  {
    code: "A201",
    level: 3,
    parentCode: "A20",
    nameFr: "Murs de fondation",
    nameEn: "Foundation Walls",
    descriptionFr: "Murs de fondation en béton et maçonnerie",
    descriptionEn: "Concrete and masonry foundation walls",
    category: "Substructure"
  },
  {
    code: "A202",
    level: 3,
    parentCode: "A20",
    nameFr: "Dalles souterraines",
    nameEn: "Basement Slabs",
    descriptionFr: "Dalles de béton au sous-sol",
    descriptionEn: "Basement concrete slabs",
    category: "Substructure"
  },

  // B10 - SUPERSTRUCTURE
  {
    code: "B101",
    level: 3,
    parentCode: "B10",
    nameFr: "Structure des planchers",
    nameEn: "Floor Construction",
    descriptionFr: "Systèmes de planchers structuraux",
    descriptionEn: "Structural floor systems",
    category: "Shell"
  },
  {
    code: "B102",
    level: 3,
    parentCode: "B10",
    nameFr: "Structure de toiture",
    nameEn: "Roof Construction",
    descriptionFr: "Charpente et structure de toiture",
    descriptionEn: "Roof framing and structural systems",
    category: "Shell"
  },

  // B20 - EXTERIOR ENCLOSURE
  {
    code: "B201",
    level: 3,
    parentCode: "B20",
    nameFr: "Murs extérieurs",
    nameEn: "Exterior Walls",
    descriptionFr: "Systèmes de murs extérieurs",
    descriptionEn: "Exterior wall systems",
    category: "Shell"
  },
  {
    code: "B202",
    level: 3,
    parentCode: "B20",
    nameFr: "Fenêtres extérieures",
    nameEn: "Exterior Windows",
    descriptionFr: "Fenêtres et systèmes de fenestration",
    descriptionEn: "Windows and fenestration systems",
    category: "Shell"
  },
  {
    code: "B203",
    level: 3,
    parentCode: "B20",
    nameFr: "Portes extérieures",
    nameEn: "Exterior Doors",
    descriptionFr: "Portes et systèmes d'entrée extérieurs",
    descriptionEn: "Exterior doors and entrance systems",
    category: "Shell"
  },

  // B30 - ROOFING
  {
    code: "B301",
    level: 3,
    parentCode: "B30",
    nameFr: "Couverture de toiture",
    nameEn: "Roof Coverings",
    descriptionFr: "Matériaux de couverture et membranes",
    descriptionEn: "Roofing materials and membranes",
    category: "Shell"
  },
  {
    code: "B302",
    level: 3,
    parentCode: "B30",
    nameFr: "Ouvertures de toiture",
    nameEn: "Roof Openings",
    descriptionFr: "Lucarnes, puits de lumière et ouvertures",
    descriptionEn: "Dormers, skylights and roof openings",
    category: "Shell"
  },

  // LEVEL 4 - INDIVIDUAL ELEMENTS (A - SUBSTRUCTURE)

  // A101 - STANDARD FOUNDATIONS
  {
    code: "A1010",
    level: 4,
    parentCode: "A101",
    nameFr: "Semelles de fondation en béton coulé sur place",
    nameEn: "Cast-in-Place Concrete Footings",
    descriptionFr: "Semelles de fondation en béton armé coulées directement sur le site, adaptées aux conditions de gel du Québec",
    descriptionEn: "Reinforced concrete footings cast in place, designed for Quebec freeze conditions",
    typicalLifespan: 75,
    category: "Substructure"
  },
  {
    code: "A1020",
    level: 4,
    parentCode: "A101",
    nameFr: "Semelles de fondation préfabriquées",
    nameEn: "Precast Concrete Footings",
    descriptionFr: "Semelles de fondation préfabriquées installées sur site",
    descriptionEn: "Precast concrete footings installed on site",
    typicalLifespan: 70,
    category: "Substructure"
  },
  {
    code: "A1030",
    level: 4,
    parentCode: "A101",
    nameFr: "Fondations continues en béton",
    nameEn: "Continuous Concrete Strip Footings",
    descriptionFr: "Fondations continues sous les murs porteurs",
    descriptionEn: "Continuous strip footings under bearing walls",
    typicalLifespan: 75,
    category: "Substructure"
  },

  // A102 - SPECIAL FOUNDATIONS
  {
    code: "A1210",
    level: 4,
    parentCode: "A102",
    nameFr: "Pieux battus en acier",
    nameEn: "Driven Steel Piles", 
    descriptionFr: "Pieux d'acier battus pour fondations profondes",
    descriptionEn: "Driven steel piles for deep foundations",
    typicalLifespan: 50,
    category: "Substructure"
  },
  {
    code: "A1220",
    level: 4,
    parentCode: "A102",
    nameFr: "Pieux forés en béton",
    nameEn: "Drilled Concrete Piles",
    descriptionFr: "Pieux en béton coulés dans des trous forés",
    descriptionEn: "Concrete piles cast in drilled holes",
    typicalLifespan: 60,
    category: "Substructure"
  },
  {
    code: "A1230",
    level: 4,
    parentCode: "A102",
    nameFr: "Micropieux",
    nameEn: "Micropiles",
    descriptionFr: "Micropieux pour fondations dans des espaces restreints",
    descriptionEn: "Micropiles for foundations in confined spaces",
    typicalLifespan: 45,
    category: "Substructure"
  },

  // A201 - FOUNDATION WALLS
  {
    code: "A2010",
    level: 4,
    parentCode: "A201",
    nameFr: "Murs de fondation en béton coulé",
    nameEn: "Cast-in-Place Concrete Foundation Walls",
    descriptionFr: "Murs de fondation en béton armé avec isolation contre le gel",
    descriptionEn: "Reinforced concrete foundation walls with frost protection insulation",
    typicalLifespan: 60,
    category: "Substructure"
  },
  {
    code: "A2020",
    level: 4,
    parentCode: "A201",
    nameFr: "Murs de fondation en blocs de béton",
    nameEn: "Concrete Masonry Unit Foundation Walls",
    descriptionFr: "Murs de fondation en blocs de béton avec renfort vertical",
    descriptionEn: "Concrete masonry unit foundation walls with vertical reinforcement",
    typicalLifespan: 55,
    category: "Substructure"
  },
  {
    code: "A2030",
    level: 4,
    parentCode: "A201",
    nameFr: "Murs de fondation préfabriqués",
    nameEn: "Precast Concrete Foundation Walls",
    descriptionFr: "Panneaux de fondation préfabriqués installés sur site",
    descriptionEn: "Precast concrete foundation panels installed on site",
    typicalLifespan: 50,
    category: "Substructure"
  },

  // A202 - BASEMENT SLABS
  {
    code: "A2210",
    level: 4,
    parentCode: "A202",
    nameFr: "Dalle de sous-sol en béton coulé",
    nameEn: "Cast-in-Place Concrete Basement Slab",
    descriptionFr: "Dalle de béton coulée sur place avec barrière contre l'humidité",
    descriptionEn: "Cast-in-place concrete slab with vapor barrier",
    typicalLifespan: 50,
    category: "Substructure"
  },
  {
    code: "A2220",
    level: 4,
    parentCode: "A202",
    nameFr: "Dalle de sous-sol avec isolation sous dalle",
    nameEn: "Insulated Basement Slab",
    descriptionFr: "Dalle de béton avec isolation thermique sous la dalle",
    descriptionEn: "Concrete slab with thermal insulation below slab",
    typicalLifespan: 45,
    category: "Substructure"
  },

  // LEVEL 4 - INDIVIDUAL ELEMENTS (B - SHELL)

  // B101 - FLOOR CONSTRUCTION
  {
    code: "B1010",
    level: 4,
    parentCode: "B101",
    nameFr: "Planchers en béton coulé sur place",
    nameEn: "Cast-in-Place Concrete Floor Systems",
    descriptionFr: "Dalles de béton armé coulées sur place",
    descriptionEn: "Reinforced concrete slabs cast in place",
    typicalLifespan: 50,
    category: "Shell"
  },
  {
    code: "B1020",
    level: 4,
    parentCode: "B101",
    nameFr: "Planchers préfabriqués en béton",
    nameEn: "Precast Concrete Floor Systems",
    descriptionFr: "Éléments de plancher préfabriqués en béton",
    descriptionEn: "Precast concrete floor elements",
    typicalLifespan: 45,
    category: "Shell"
  },
  {
    code: "B1030",
    level: 4,
    parentCode: "B101",
    nameFr: "Planchers en bois d'ingénierie",
    nameEn: "Engineered Wood Floor Systems",
    descriptionFr: "Systèmes de planchers en produits de bois d'ingénierie",
    descriptionEn: "Engineered wood product floor systems",
    typicalLifespan: 40,
    category: "Shell"
  },
  {
    code: "B1040",
    level: 4,
    parentCode: "B101",
    nameFr: "Planchers en acier",
    nameEn: "Steel Floor Systems",
    descriptionFr: "Systèmes de planchers en acier avec dalle composite",
    descriptionEn: "Steel floor systems with composite deck",
    typicalLifespan: 50,
    category: "Shell"
  },

  // B102 - ROOF CONSTRUCTION
  {
    code: "B1210",
    level: 4,
    parentCode: "B102",
    nameFr: "Charpente de toit en bois",
    nameEn: "Wood Roof Framing",
    descriptionFr: "Charpente de toit en bois dimensionnel et produits d'ingénierie",
    descriptionEn: "Wood roof framing using dimensional lumber and engineered products",
    typicalLifespan: 35,
    category: "Shell"
  },
  {
    code: "B1220",
    level: 4,
    parentCode: "B102",
    nameFr: "Charpente de toit en acier",
    nameEn: "Steel Roof Framing",
    descriptionFr: "Charpente de toit en acier structurel",
    descriptionEn: "Structural steel roof framing",
    typicalLifespan: 45,
    category: "Shell"
  },
  {
    code: "B1230",
    level: 4,
    parentCode: "B102",
    nameFr: "Fermes de toit préfabriquées",
    nameEn: "Prefabricated Roof Trusses",
    descriptionFr: "Fermes de toit préfabriquées en bois ou acier",
    descriptionEn: "Prefabricated wood or steel roof trusses",
    typicalLifespan: 40,
    category: "Shell"
  },

  // B201 - EXTERIOR WALLS
  {
    code: "B2010",
    level: 4,
    parentCode: "B201",
    nameFr: "Murs en maçonnerie avec isolation",
    nameEn: "Insulated Masonry Walls",
    descriptionFr: "Murs en brique ou bloc avec isolation continue adaptée au climat québécois",
    descriptionEn: "Brick or block walls with continuous insulation for Quebec climate",
    typicalLifespan: 50,
    category: "Shell"
  },
  {
    code: "B2020",
    level: 4,
    parentCode: "B201",
    nameFr: "Murs à ossature bois avec revêtement",
    nameEn: "Wood Frame Walls with Cladding",
    descriptionFr: "Ossature bois avec isolant en fibre de verre et pare-vapeur",
    descriptionEn: "Wood frame with fiberglass insulation and vapor barrier",
    typicalLifespan: 30,
    category: "Shell"
  },
  {
    code: "B2030",
    level: 4,
    parentCode: "B201",
    nameFr: "Murs-rideaux en métal et verre",
    nameEn: "Metal and Glass Curtain Walls",
    descriptionFr: "Systèmes de murs-rideaux avec performance thermique élevée",
    descriptionEn: "Curtain wall systems with high thermal performance",
    typicalLifespan: 25,
    category: "Shell"
  },
  {
    code: "B2040",
    level: 4,
    parentCode: "B201",
    nameFr: "Murs préfabriqués en béton",
    nameEn: "Precast Concrete Walls",
    descriptionFr: "Panneaux de béton préfabriqués avec isolation intégrée",
    descriptionEn: "Precast concrete panels with integral insulation",
    typicalLifespan: 40,
    category: "Shell"
  },

  // B202 - EXTERIOR WINDOWS
  {
    code: "B2210",
    level: 4,
    parentCode: "B202",
    nameFr: "Fenêtres en vinyle à triple vitrage",
    nameEn: "Triple Glazed Vinyl Windows",
    descriptionFr: "Fenêtres en vinyle avec triple vitrage pour efficacité énergétique",
    descriptionEn: "Vinyl windows with triple glazing for energy efficiency",
    typicalLifespan: 25,
    category: "Shell"
  },
  {
    code: "B2220",
    level: 4,
    parentCode: "B202",
    nameFr: "Fenêtres en bois à haute performance",
    nameEn: "High Performance Wood Windows",
    descriptionFr: "Fenêtres en bois avec revêtement extérieur en aluminium",
    descriptionEn: "Wood windows with exterior aluminum cladding",
    typicalLifespan: 30,
    category: "Shell"
  },
  {
    code: "B2230",
    level: 4,
    parentCode: "B202",
    nameFr: "Fenêtres en aluminium thermiquement coupé",
    nameEn: "Thermally Broken Aluminum Windows",
    descriptionFr: "Fenêtres en aluminium avec rupture de pont thermique",
    descriptionEn: "Aluminum windows with thermal break technology",
    typicalLifespan: 35,
    category: "Shell"
  },

  // B203 - EXTERIOR DOORS  
  {
    code: "B2310",
    level: 4,
    parentCode: "B203",
    nameFr: "Portes d'entrée en acier isolées",
    nameEn: "Insulated Steel Entry Doors",
    descriptionFr: "Portes d'entrée en acier avec âme isolante",
    descriptionEn: "Steel entry doors with insulated core",
    typicalLifespan: 20,
    category: "Shell"
  },
  {
    code: "B2320",
    level: 4,
    parentCode: "B203",
    nameFr: "Portes-fenêtres coulissantes",
    nameEn: "Sliding Patio Doors",
    descriptionFr: "Portes-fenêtres coulissantes en vinyle ou aluminium",
    descriptionEn: "Sliding patio doors in vinyl or aluminum",
    typicalLifespan: 25,
    category: "Shell"
  },
  {
    code: "B2330",
    level: 4,
    parentCode: "B203",
    nameFr: "Portes coupe-feu extérieures",
    nameEn: "Exterior Fire Doors",
    descriptionFr: "Portes coupe-feu pour sorties d'urgence",
    descriptionEn: "Fire-rated doors for emergency exits",
    typicalLifespan: 30,
    category: "Shell"
  },

  // B301 - ROOF COVERINGS
  {
    code: "B3010",
    level: 4,
    parentCode: "B301",
    nameFr: "Membrane élastomère pour toit plat",
    nameEn: "Elastomeric Membrane Flat Roofing",
    descriptionFr: "Membrane élastomère bicouche adaptée aux cycles gel-dégel",
    descriptionEn: "Two-ply elastomeric membrane suitable for freeze-thaw cycles",
    typicalLifespan: 25,
    category: "Shell"
  },
  {
    code: "B3020",
    level: 4,
    parentCode: "B301",
    nameFr: "Bardeaux d'asphalte", 
    nameEn: "Asphalt Shingles",
    descriptionFr: "Bardeaux d'asphalte résistants au vent et à la grêle",
    descriptionEn: "Wind and hail resistant asphalt shingles",
    typicalLifespan: 20,
    category: "Shell"
  },
  {
    code: "B3030",
    level: 4,
    parentCode: "B301",
    nameFr: "Couverture métallique",
    nameEn: "Metal Roofing",
    descriptionFr: "Toiture métallique en acier galvanisé ou aluminium",
    descriptionEn: "Metal roofing in galvanized steel or aluminum",
    typicalLifespan: 40,
    category: "Shell"
  },
  {
    code: "B3040",
    level: 4,
    parentCode: "B301",
    nameFr: "Membrane TPO pour toit plat",
    nameEn: "TPO Single-Ply Membrane Roofing",
    descriptionFr: "Membrane thermoplastique mono-couche",
    descriptionEn: "Thermoplastic single-ply membrane",
    typicalLifespan: 20,
    category: "Shell"
  },

  // B302 - ROOF OPENINGS
  {
    code: "B3210",
    level: 4,
    parentCode: "B302",
    nameFr: "Puits de lumière résidentiels",
    nameEn: "Residential Skylights",
    descriptionFr: "Puits de lumière avec verre isolant et solin intégré",
    descriptionEn: "Skylights with insulated glazing and integral flashing",
    typicalLifespan: 20,
    category: "Shell"
  },
  {
    code: "B3220",
    level: 4,
    parentCode: "B302",
    nameFr: "Trappes d'accès au toit",
    nameEn: "Roof Access Hatches",
    descriptionFr: "Trappes d'accès isolées avec échelle intégrée",
    descriptionEn: "Insulated access hatches with integral ladder",
    typicalLifespan: 25,
    category: "Shell"
  },

  // LEVEL 4 - INDIVIDUAL ELEMENTS (C - INTERIORS)

  // C101 - PARTITIONS
  {
    code: "C1010",
    level: 3,
    parentCode: "C10",
    nameFr: "Cloisons intérieures",
    nameEn: "Interior Partitions",
    descriptionFr: "Systèmes de cloisons non porteuses",
    descriptionEn: "Non-load bearing partition systems",
    category: "Interiors"
  },
  {
    code: "C10101",
    level: 4,
    parentCode: "C1010",
    nameFr: "Cloisons en placoplâtre",
    nameEn: "Gypsum Board Partitions",
    descriptionFr: "Cloisons en ossature métallique avec panneaux de gypse",
    descriptionEn: "Metal stud framing with gypsum board",
    typicalLifespan: 30,
    category: "Interiors"
  },
  {
    code: "C10102",
    level: 4,
    parentCode: "C1010",
    nameFr: "Cloisons en blocs de béton",
    nameEn: "Concrete Masonry Unit Partitions",
    descriptionFr: "Cloisons en blocs de béton léger",
    descriptionEn: "Lightweight concrete masonry unit partitions",
    typicalLifespan: 50,
    category: "Interiors"
  },

  // C102 - INTERIOR DOORS
  {
    code: "C1020",
    level: 3,
    parentCode: "C10",
    nameFr: "Portes intérieures",
    nameEn: "Interior Doors",
    descriptionFr: "Portes et quincaillerie intérieures",
    descriptionEn: "Interior doors and hardware",
    category: "Interiors"
  },
  {
    code: "C10201",
    level: 4,
    parentCode: "C1020",
    nameFr: "Portes en bois massif",
    nameEn: "Solid Wood Doors",
    descriptionFr: "Portes intérieures en bois massif avec quincaillerie",
    descriptionEn: "Solid wood interior doors with hardware",
    typicalLifespan: 40,
    category: "Interiors"
  },
  {
    code: "C10202",
    level: 4,
    parentCode: "C1020",
    nameFr: "Portes creuses en bois",
    nameEn: "Hollow Core Wood Doors",
    descriptionFr: "Portes à âme creuse avec placage de bois",
    descriptionEn: "Hollow core doors with wood veneer",
    typicalLifespan: 25,
    category: "Interiors"
  },

  // C201 - STAIRS
  {
    code: "C2010",
    level: 4,
    parentCode: "C20",
    nameFr: "Escaliers en béton",
    nameEn: "Concrete Stairs",
    descriptionFr: "Escaliers en béton coulé avec garde-corps",
    descriptionEn: "Cast-in-place concrete stairs with railings",
    typicalLifespan: 50,
    category: "Interiors"
  },
  {
    code: "C2020",
    level: 4,
    parentCode: "C20",
    nameFr: "Escaliers en bois",
    nameEn: "Wood Stairs",
    descriptionFr: "Escaliers en bois franc avec garde-corps",
    descriptionEn: "Hardwood stairs with railings",
    typicalLifespan: 40,
    category: "Interiors"
  },
  {
    code: "C2030",
    level: 4,
    parentCode: "C20",
    nameFr: "Escaliers métalliques",
    nameEn: "Metal Stairs",
    descriptionFr: "Escaliers en acier avec marches antidérapantes",
    descriptionEn: "Steel stairs with non-slip treads",
    typicalLifespan: 35,
    category: "Interiors"
  },

  // C301 - WALL FINISHES
  {
    code: "C3010",
    level: 3,
    parentCode: "C30",
    nameFr: "Finitions murales",
    nameEn: "Wall Finishes",
    descriptionFr: "Revêtements et finitions de murs intérieurs",
    descriptionEn: "Interior wall coverings and finishes",
    category: "Interiors"
  },
  {
    code: "C30101",
    level: 4,
    parentCode: "C3010",
    nameFr: "Peinture sur placoplâtre",
    nameEn: "Gypsum Board Paint Finish",
    descriptionFr: "Peinture acrylique sur panneaux de gypse",
    descriptionEn: "Acrylic paint on gypsum board",
    typicalLifespan: 8,
    category: "Interiors"
  },
  {
    code: "C30102",
    level: 4,
    parentCode: "C3010",
    nameFr: "Carrelage céramique mural",
    nameEn: "Ceramic Wall Tile",
    descriptionFr: "Carrelage céramique pour salles de bains et cuisines",
    descriptionEn: "Ceramic tile for bathrooms and kitchens",
    typicalLifespan: 25,
    category: "Interiors"
  },

  // C302 - FLOOR FINISHES
  {
    code: "C3020",
    level: 3,
    parentCode: "C30",
    nameFr: "Revêtements de sol",
    nameEn: "Floor Finishes",
    descriptionFr: "Revêtements de sol intérieurs",
    descriptionEn: "Interior floor finishes",
    category: "Interiors"
  },
  {
    code: "C30201",
    level: 4,
    parentCode: "C3020",
    nameFr: "Plancher de bois franc",
    nameEn: "Hardwood Flooring",
    descriptionFr: "Plancher de bois franc en érable ou chêne",
    descriptionEn: "Hardwood flooring in maple or oak",
    typicalLifespan: 40,
    category: "Interiors"
  },
  {
    code: "C30202",
    level: 4,
    parentCode: "C3020",
    nameFr: "Revêtement vinylique de luxe",
    nameEn: "Luxury Vinyl Plank Flooring",
    descriptionFr: "Planches vinyliques de luxe avec sous-couche",
    descriptionEn: "Luxury vinyl plank with underlayment",
    typicalLifespan: 15,
    category: "Interiors"
  },
  {
    code: "C30203",
    level: 4,
    parentCode: "C3020",
    nameFr: "Carrelage céramique",
    nameEn: "Ceramic Floor Tile",
    descriptionFr: "Carrelage céramique avec joint étanche",
    descriptionEn: "Ceramic tile with waterproof grout",
    typicalLifespan: 30,
    category: "Interiors"
  },
  {
    code: "C30204",
    level: 4,
    parentCode: "C3020",
    nameFr: "Tapis avec thibaude",
    nameEn: "Carpet with Pad",
    descriptionFr: "Tapis résidentiel avec sous-couche",
    descriptionEn: "Residential carpet with padding",
    typicalLifespan: 10,
    category: "Interiors"
  },

  // C303 - CEILING FINISHES  
  {
    code: "C3030",
    level: 3,
    parentCode: "C30",
    nameFr: "Finitions de plafond",
    nameEn: "Ceiling Finishes",
    descriptionFr: "Systèmes et finitions de plafonds",
    descriptionEn: "Ceiling systems and finishes",
    category: "Interiors"
  },
  {
    code: "C30301",
    level: 4,
    parentCode: "C3030",
    nameFr: "Plafond suspendu acoustique",
    nameEn: "Suspended Acoustic Ceiling",
    descriptionFr: "Plafond suspendu avec carreaux acoustiques",
    descriptionEn: "Suspended ceiling with acoustic tiles",
    typicalLifespan: 20,
    category: "Interiors"
  },
  {
    code: "C30302",
    level: 4,
    parentCode: "C3030",
    nameFr: "Plafond en placoplâtre peint",
    nameEn: "Painted Gypsum Board Ceiling",
    descriptionFr: "Plafond en panneaux de gypse avec peinture",
    descriptionEn: "Gypsum board ceiling with paint finish",
    typicalLifespan: 15,
    category: "Interiors"
  },

  // LEVEL 4 - INDIVIDUAL ELEMENTS (D - SERVICES)

  // D101 - ELEVATORS
  {
    code: "D1010",
    level: 3,
    parentCode: "D10",
    nameFr: "Ascenseurs électriques",
    nameEn: "Electric Elevators",
    descriptionFr: "Systèmes d'ascenseurs électriques pour passagers",
    descriptionEn: "Electric passenger elevator systems",
    category: "Services"
  },
  {
    code: "D10101",
    level: 4,
    parentCode: "D1010",
    nameFr: "Ascenseur hydraulique résidentiel",
    nameEn: "Residential Hydraulic Elevator",
    descriptionFr: "Ascenseur hydraulique pour bâtiments résidentiels de faible hauteur",
    descriptionEn: "Hydraulic elevator for low-rise residential buildings",
    typicalLifespan: 25,
    category: "Services"
  },
  {
    code: "D10102",
    level: 4,
    parentCode: "D1010",
    nameFr: "Ascenseur à traction électrique",
    nameEn: "Electric Traction Elevator",
    descriptionFr: "Ascenseur à traction électrique pour bâtiments moyens",
    descriptionEn: "Electric traction elevator for mid-rise buildings",
    typicalLifespan: 30,
    category: "Services"
  },

  // D201 - PLUMBING FIXTURES
  {
    code: "D2010",
    level: 3,
    parentCode: "D20",
    nameFr: "Appareils sanitaires",
    nameEn: "Plumbing Fixtures",
    descriptionFr: "Toilettes, lavabos et appareils sanitaires",
    descriptionEn: "Toilets, sinks and plumbing fixtures",
    category: "Services"
  },
  {
    code: "D20101",
    level: 4,
    parentCode: "D2010",
    nameFr: "Toilettes à faible débit",
    nameEn: "Low Flow Toilets",
    descriptionFr: "Toilettes à chasse d'eau économique certifiées WaterSense",
    descriptionEn: "WaterSense certified low flow toilets",
    typicalLifespan: 20,
    category: "Services"
  },
  {
    code: "D20102",
    level: 4,
    parentCode: "D2010",
    nameFr: "Lavabos en porcelaine",
    nameEn: "Porcelain Lavatories",
    descriptionFr: "Lavabos en porcelaine avec robinetterie",
    descriptionEn: "Porcelain lavatories with faucets",
    typicalLifespan: 25,
    category: "Services"
  },

  // D202 - DOMESTIC WATER DISTRIBUTION
  {
    code: "D2020",
    level: 3,
    parentCode: "D20",
    nameFr: "Distribution d'eau domestique",
    nameEn: "Domestic Water Distribution",
    descriptionFr: "Systèmes de distribution d'eau potable",
    descriptionEn: "Potable water distribution systems",
    category: "Services"
  },
  {
    code: "D20201",
    level: 4,
    parentCode: "D2020",
    nameFr: "Tuyauterie en cuivre",
    nameEn: "Copper Piping",
    descriptionFr: "Tuyauterie en cuivre pour eau potable avec joints soudés",
    descriptionEn: "Copper piping for potable water with soldered joints",
    typicalLifespan: 40,
    category: "Services"
  },
  {
    code: "D20202",
    level: 4,
    parentCode: "D2020",
    nameFr: "Tuyauterie PEX",
    nameEn: "PEX Piping",
    descriptionFr: "Tuyauterie en polyéthylène réticulé avec raccords à compression",
    descriptionEn: "Cross-linked polyethylene piping with compression fittings",
    typicalLifespan: 30,
    category: "Services"
  },

  // D203 - SANITARY WASTE
  {
    code: "D2030",
    level: 3,
    parentCode: "D20",
    nameFr: "Évacuation des eaux usées",
    nameEn: "Sanitary Waste",
    descriptionFr: "Systèmes d'évacuation des eaux usées",
    descriptionEn: "Sanitary waste systems",
    category: "Services"
  },
  {
    code: "D20301",
    level: 4,
    parentCode: "D2030",
    nameFr: "Tuyauterie d'évacuation en PVC",
    nameEn: "PVC Waste Piping",
    descriptionFr: "Tuyauterie d'évacuation en PVC avec joints collés",
    descriptionEn: "PVC waste piping with solvent welded joints",
    typicalLifespan: 35,
    category: "Services"
  },
  {
    code: "D20302",
    level: 4,
    parentCode: "D2030",
    nameFr: "Tuyauterie d'évacuation en fonte",
    nameEn: "Cast Iron Waste Piping",
    descriptionFr: "Tuyauterie d'évacuation en fonte pour bâtiments commerciaux",
    descriptionEn: "Cast iron waste piping for commercial buildings",
    typicalLifespan: 50,
    category: "Services"
  },

  // D301 - ENERGY SUPPLY
  {
    code: "D3010",
    level: 3,
    parentCode: "D30",
    nameFr: "Fourniture d'énergie",
    nameEn: "Energy Supply",
    descriptionFr: "Systèmes de production et distribution d'énergie",
    descriptionEn: "Energy generation and distribution systems",
    category: "Services"
  },
  {
    code: "D30101",
    level: 4,
    parentCode: "D3010",
    nameFr: "Chaudière au gaz naturel haute efficacité",
    nameEn: "High Efficiency Natural Gas Boiler",
    descriptionFr: "Chaudière à condensation au gaz naturel pour chauffage hydronique",
    descriptionEn: "Condensing natural gas boiler for hydronic heating",
    typicalLifespan: 20,
    category: "Services"
  },
  {
    code: "D30102",
    level: 4,
    parentCode: "D3010",
    nameFr: "Thermopompe géothermique",
    nameEn: "Geothermal Heat Pump",
    descriptionFr: "Système géothermique pour chauffage et climatisation",
    descriptionEn: "Geothermal system for heating and cooling",
    typicalLifespan: 25,
    category: "Services"
  },
  {
    code: "D30103",
    level: 4,
    parentCode: "D3010",
    nameFr: "Chaudière électrique",
    nameEn: "Electric Boiler",
    descriptionFr: "Chaudière électrique pour chauffage hydronique résidentiel",
    descriptionEn: "Electric boiler for residential hydronic heating",
    typicalLifespan: 18,
    category: "Services"
  },

  // D302 - HEAT GENERATING SYSTEMS
  {
    code: "D3020",
    level: 3,
    parentCode: "D30",
    nameFr: "Systèmes de génération de chaleur",
    nameEn: "Heat Generating Systems",
    descriptionFr: "Équipements de production de chaleur",
    descriptionEn: "Heat generation equipment",
    category: "Services"
  },
  {
    code: "D30201",
    level: 4,
    parentCode: "D3020",
    nameFr: "Plinthes électriques",
    nameEn: "Electric Baseboard Heaters",
    descriptionFr: "Plinthes chauffantes électriques avec thermostats individuels",
    descriptionEn: "Electric baseboard heaters with individual thermostats",
    typicalLifespan: 20,
    category: "Services"
  },
  {
    code: "D30202",
    level: 4,
    parentCode: "D3020",
    nameFr: "Radiateurs hydroniques",
    nameEn: "Hydronic Radiators",
    descriptionFr: "Radiateurs à eau chaude en fonte ou aluminium",
    descriptionEn: "Hot water radiators in cast iron or aluminum",
    typicalLifespan: 30,
    category: "Services"
  },
  {
    code: "D30203",
    level: 4,
    parentCode: "D3020",
    nameFr: "Plancher radiant électrique",
    nameEn: "Electric Radiant Floor Heating",
    descriptionFr: "Système de chauffage radiant électrique sous carrelage",
    descriptionEn: "Electric radiant heating system under tile",
    typicalLifespan: 25,
    category: "Services"
  },

  // D303 - DISTRIBUTION SYSTEMS
  {
    code: "D3030",
    level: 3,
    parentCode: "D30",
    nameFr: "Systèmes de distribution",
    nameEn: "Distribution Systems",
    descriptionFr: "Systèmes de distribution de l'air et de l'eau",
    descriptionEn: "Air and water distribution systems",
    category: "Services"
  },
  {
    code: "D30301",
    level: 4,
    parentCode: "D3030",
    nameFr: "Conduits de ventilation en métal",
    nameEn: "Metal Ductwork",
    descriptionFr: "Conduits de ventilation en acier galvanisé isolés",
    descriptionEn: "Insulated galvanized steel ductwork",
    typicalLifespan: 25,
    category: "Services"
  },
  {
    code: "D30302",
    level: 4,
    parentCode: "D3030",
    nameFr: "VRC - Ventilateur récupérateur de chaleur",
    nameEn: "HRV - Heat Recovery Ventilator",
    descriptionFr: "Système de ventilation avec récupération de chaleur",
    descriptionEn: "Heat recovery ventilation system",
    typicalLifespan: 15,
    category: "Services"
  },

  // D401 - SPRINKLERS
  {
    code: "D4010",
    level: 3,
    parentCode: "D40",
    nameFr: "Systèmes de gicleurs",
    nameEn: "Sprinkler Systems",
    descriptionFr: "Systèmes d'extinction automatique par gicleurs",
    descriptionEn: "Automatic sprinkler suppression systems",
    category: "Services"
  },
  {
    code: "D40101",
    level: 4,
    parentCode: "D4010",
    nameFr: "Gicleurs sous eau",
    nameEn: "Wet Pipe Sprinkler System",
    descriptionFr: "Système de gicleurs sous eau pour zones chauffées",
    descriptionEn: "Wet pipe sprinkler system for heated areas",
    typicalLifespan: 30,
    category: "Services"
  },
  {
    code: "D40102",
    level: 4,
    parentCode: "D4010",
    nameFr: "Gicleurs sous air",
    nameEn: "Dry Pipe Sprinkler System",
    descriptionFr: "Système de gicleurs sous air pour zones non chauffées",
    descriptionEn: "Dry pipe sprinkler system for unheated areas",
    typicalLifespan: 25,
    category: "Services"
  },

  // D402 - STANDPIPES
  {
    code: "D4020",
    level: 3,
    parentCode: "D40",
    nameFr: "Colonnes montantes",
    nameEn: "Standpipes",
    descriptionFr: "Colonnes montantes pour intervention des pompiers",
    descriptionEn: "Fire department standpipe systems",
    category: "Services"
  },
  {
    code: "D40201",
    level: 4,
    parentCode: "D4020",
    nameFr: "Colonne montante sèche",
    nameEn: "Dry Standpipe System",
    descriptionFr: "Colonne montante sèche avec raccordements pompiers",
    descriptionEn: "Dry standpipe with fire department connections",
    typicalLifespan: 40,
    category: "Services"
  },

  // D501 - ELECTRICAL SERVICE
  {
    code: "D5010",
    level: 3,
    parentCode: "D50",
    nameFr: "Service électrique",
    nameEn: "Electrical Service/Distribution",
    descriptionFr: "Entrée électrique et distribution principale",
    descriptionEn: "Electrical service entrance and main distribution",
    category: "Services"
  },
  {
    code: "D50101",
    level: 4,
    parentCode: "D5010",
    nameFr: "Panneau électrique principal 200A",
    nameEn: "200 Amp Main Electrical Panel",
    descriptionFr: "Panneau électrique principal 200 ampères avec disjoncteurs",
    descriptionEn: "200 amp main electrical panel with circuit breakers",
    typicalLifespan: 30,
    category: "Services"
  },
  {
    code: "D50102",
    level: 4,
    parentCode: "D5010",
    nameFr: "Compteur électrique",
    nameEn: "Electric Meter",
    descriptionFr: "Compteur électrique avec base d'installation",
    descriptionEn: "Electric meter with mounting base",
    typicalLifespan: 25,
    category: "Services"
  },

  // D502 - LIGHTING AND BRANCH WIRING
  {
    code: "D5020",
    level: 3,
    parentCode: "D50",
    nameFr: "Éclairage et câblage",
    nameEn: "Lighting and Branch Wiring",
    descriptionFr: "Systèmes d'éclairage et circuits électriques",
    descriptionEn: "Lighting systems and electrical circuits",
    category: "Services"
  },
  {
    code: "D50201",
    level: 4,
    parentCode: "D5020",
    nameFr: "Luminaires DEL intérieurs",
    nameEn: "Interior LED Fixtures",
    descriptionFr: "Luminaires DEL intérieurs avec gradateur",
    descriptionEn: "Interior LED fixtures with dimmer control",
    typicalLifespan: 20,
    category: "Services"
  },
  {
    code: "D50202",
    level: 4,
    parentCode: "D5020",
    nameFr: "Câblage en cuivre 14 AWG",
    nameEn: "14 AWG Copper Wiring",
    descriptionFr: "Câblage électrique en cuivre 14 AWG dans conduit",
    descriptionEn: "14 AWG copper electrical wiring in conduit",
    typicalLifespan: 40,
    category: "Services"
  },
  {
    code: "D50203",
    level: 4,
    parentCode: "D5020",
    nameFr: "Prises DDFT",
    nameEn: "GFCI Outlets",
    descriptionFr: "Prises avec disjoncteur de fuite à la terre",
    descriptionEn: "Ground fault circuit interrupter outlets",
    typicalLifespan: 15,
    category: "Services"
  },

  // LEVEL 4 - INDIVIDUAL ELEMENTS (E - EQUIPMENT & FURNISHINGS)

  // E101 - COMMERCIAL EQUIPMENT
  {
    code: "E1010",
    level: 3,
    parentCode: "E10",
    nameFr: "Équipements commerciaux",
    nameEn: "Commercial Equipment",
    descriptionFr: "Équipements spécialisés pour bâtiments commerciaux",
    descriptionEn: "Specialized equipment for commercial buildings",
    category: "Equipment & Furnishings"
  },
  {
    code: "E10101",
    level: 4,
    parentCode: "E1010",
    nameFr: "Équipements de buanderie commerciale",
    nameEn: "Commercial Laundry Equipment",
    descriptionFr: "Laveuses et sécheuses commerciales",
    descriptionEn: "Commercial washers and dryers",
    typicalLifespan: 12,
    category: "Equipment & Furnishings"
  },

  // E201 - FIXED FURNISHINGS
  {
    code: "E2010",
    level: 3,
    parentCode: "E20",
    nameFr: "Ameublement fixe",
    nameEn: "Fixed Furnishings",
    descriptionFr: "Ameublement et équipements fixes",
    descriptionEn: "Fixed furnishings and equipment",
    category: "Equipment & Furnishings"
  },
  {
    code: "E20101",
    level: 4,
    parentCode: "E2010",
    nameFr: "Armoires de cuisine sur mesure",
    nameEn: "Custom Kitchen Cabinets",
    descriptionFr: "Armoires de cuisine en bois avec comptoirs",
    descriptionEn: "Wood kitchen cabinets with countertops",
    typicalLifespan: 25,
    category: "Equipment & Furnishings"
  },
  {
    code: "E20102",
    level: 4,
    parentCode: "E2010",
    nameFr: "Vanités de salle de bain",
    nameEn: "Bathroom Vanities",
    descriptionFr: "Vanités de salle de bain avec comptoir et miroir",
    descriptionEn: "Bathroom vanities with countertop and mirror",
    typicalLifespan: 20,
    category: "Equipment & Furnishings"
  },

  // LEVEL 4 - INDIVIDUAL ELEMENTS (F - SPECIAL CONSTRUCTION & DEMOLITION)

  // F101 - SPECIAL STRUCTURES
  {
    code: "F1010",
    level: 3,
    parentCode: "F10",
    nameFr: "Structures spécialisées",
    nameEn: "Special Structures",
    descriptionFr: "Constructions et structures spécialisées",
    descriptionEn: "Specialized construction and structures",
    category: "Special Construction & Demolition"
  },
  {
    code: "F10101",
    level: 4,
    parentCode: "F1010",
    nameFr: "Balcons et terrasses",
    nameEn: "Balconies and Decks",
    descriptionFr: "Balcons en béton ou terrasses en bois traité",
    descriptionEn: "Concrete balconies or treated wood decks",
    typicalLifespan: 20,
    category: "Special Construction & Demolition"
  },

  // F201 - DEMOLITION
  {
    code: "F2010",
    level: 3,
    parentCode: "F20",
    nameFr: "Démolition d'éléments",
    nameEn: "Building Elements Demolition",
    descriptionFr: "Démolition sélective d'éléments de bâtiment",
    descriptionEn: "Selective demolition of building elements",
    category: "Special Construction & Demolition"
  },
  {
    code: "F20101",
    level: 4,
    parentCode: "F2010",
    nameFr: "Démolition de cloisons intérieures",
    nameEn: "Interior Partition Demolition",
    descriptionFr: "Démolition de cloisons non porteuses",
    descriptionEn: "Non-load bearing partition demolition",
    typicalLifespan: 0,
    category: "Special Construction & Demolition"
  },

  // LEVEL 4 - INDIVIDUAL ELEMENTS (G - BUILDING SITEWORK)

  // G101 - SITE PREPARATION
  {
    code: "G1010",
    level: 3,
    parentCode: "G10",
    nameFr: "Déblaiement du site",
    nameEn: "Site Clearing",
    descriptionFr: "Déblaiement et démolition préparatoire",
    descriptionEn: "Site clearing and preparatory demolition",
    category: "Building Sitework"
  },
  {
    code: "G10101",
    level: 4,
    parentCode: "G1010",
    nameFr: "Déblaiement de végétation",
    nameEn: "Vegetation Clearing",
    descriptionFr: "Enlèvement d'arbres et végétation existante",
    descriptionEn: "Removal of existing trees and vegetation",
    typicalLifespan: 0,
    category: "Building Sitework"
  },
  {
    code: "G1020",
    level: 3,
    parentCode: "G10",
    nameFr: "Terrassement",
    nameEn: "Earthwork",
    descriptionFr: "Excavation, remblayage et nivellement",
    descriptionEn: "Excavation, backfill and grading",
    category: "Building Sitework"
  },
  {
    code: "G10201",
    level: 4,
    parentCode: "G1020",
    nameFr: "Excavation de fondations",
    nameEn: "Foundation Excavation",
    descriptionFr: "Excavation pour fondations et services souterrains",
    descriptionEn: "Excavation for foundations and underground utilities",
    typicalLifespan: 0,
    category: "Building Sitework"
  },

  // G201 - ROADWAYS
  {
    code: "G2010",
    level: 3,
    parentCode: "G20",
    nameFr: "Chaussées",
    nameEn: "Roadways",
    descriptionFr: "Routes d'accès et allées pavées",
    descriptionEn: "Access roads and paved driveways",
    category: "Building Sitework"
  },
  {
    code: "G20101",
    level: 4,
    parentCode: "G2010",
    nameFr: "Allée asphaltée résidentielle",
    nameEn: "Residential Asphalt Driveway",
    descriptionFr: "Allée en asphalte avec base granulaire",
    descriptionEn: "Asphalt driveway with granular base",
    typicalLifespan: 15,
    category: "Building Sitework"
  },
  {
    code: "G20102",
    level: 4,
    parentCode: "G2010",
    nameFr: "Allée en béton",
    nameEn: "Concrete Driveway",
    descriptionFr: "Allée en béton armé avec joints de dilatation",
    descriptionEn: "Reinforced concrete driveway with expansion joints",
    typicalLifespan: 25,
    category: "Building Sitework"
  },

  // G202 - WALKWAYS
  {
    code: "G2020",
    level: 3,
    parentCode: "G20",
    nameFr: "Trottoirs et allées piétonnes",
    nameEn: "Pedestrian Paving",
    descriptionFr: "Trottoirs et allées pour piétons",
    descriptionEn: "Sidewalks and pedestrian walkways",
    category: "Building Sitework"
  },
  {
    code: "G20201",
    level: 4,
    parentCode: "G2020",
    nameFr: "Trottoir en béton",
    nameEn: "Concrete Sidewalk",
    descriptionFr: "Trottoir en béton avec finition balayée",
    descriptionEn: "Concrete sidewalk with broom finish",
    typicalLifespan: 20,
    category: "Building Sitework"
  },
  {
    code: "G20202",
    level: 4,
    parentCode: "G2020",
    nameFr: "Allée en pavés unis",
    nameEn: "Interlocking Paver Walkway",
    descriptionFr: "Allée piétonne en pavés unis avec sable polymère",
    descriptionEn: "Interlocking paver walkway with polymeric sand",
    typicalLifespan: 18,
    category: "Building Sitework"
  },

  // G203 - LANDSCAPING
  {
    code: "G2030",
    level: 3,
    parentCode: "G20",
    nameFr: "Aménagement paysager",
    nameEn: "Landscaping",
    descriptionFr: "Plantation et aménagement paysager",
    descriptionEn: "Planting and landscape development",
    category: "Building Sitework"
  },
  {
    code: "G20301",
    level: 4,
    parentCode: "G2030",
    nameFr: "Pelouse ensemencée",
    nameEn: "Seeded Lawn",
    descriptionFr: "Pelouse établie par ensemencement avec terre végétale",
    descriptionEn: "Lawn established by seeding with topsoil",
    typicalLifespan: 10,
    category: "Building Sitework"
  },
  {
    code: "G20302",
    level: 4,
    parentCode: "G2030",
    nameFr: "Arbres et arbustes",
    nameEn: "Trees and Shrubs",
    descriptionFr: "Plantation d'arbres et arbustes indigènes",
    descriptionEn: "Native tree and shrub planting",
    typicalLifespan: 25,
    category: "Building Sitework"
  },

  // G301 - WATER SUPPLY
  {
    code: "G3010",
    level: 3,
    parentCode: "G30",
    nameFr: "Alimentation en eau",
    nameEn: "Water Supply",
    descriptionFr: "Raccordement et distribution d'eau potable",
    descriptionEn: "Potable water connection and distribution",
    category: "Building Sitework"
  },
  {
    code: "G30101",
    level: 4,
    parentCode: "G3010",
    nameFr: "Conduite d'eau en PVC",
    nameEn: "PVC Water Service Line",
    descriptionFr: "Conduite d'entrée d'eau en PVC avec protection contre le gel",
    descriptionEn: "PVC water service line with frost protection",
    typicalLifespan: 40,
    category: "Building Sitework"
  },

  // G302 - SANITARY SEWER
  {
    code: "G3020",
    level: 3,
    parentCode: "G30",
    nameFr: "Égout sanitaire",
    nameEn: "Sanitary Sewer",
    descriptionFr: "Raccordement et évacuation des eaux usées",
    descriptionEn: "Sanitary waste connection and drainage",
    category: "Building Sitework"
  },
  {
    code: "G30201",
    level: 4,
    parentCode: "G3020",
    nameFr: "Conduite d'égout en PVC",
    nameEn: "PVC Sewer Line",
    descriptionFr: "Conduite d'évacuation sanitaire en PVC",
    descriptionEn: "PVC sanitary sewer line",
    typicalLifespan: 35,
    category: "Building Sitework"
  },

  // G303 - STORM SEWER
  {
    code: "G3030",
    level: 3,
    parentCode: "G30",
    nameFr: "Égout pluvial",
    nameEn: "Storm Sewer",
    descriptionFr: "Drainage des eaux pluviales",
    descriptionEn: "Storm water drainage",
    category: "Building Sitework"
  },
  {
    code: "G30301",
    level: 4,
    parentCode: "G3030",
    nameFr: "Drain français",
    nameEn: "Foundation Drain",
    descriptionFr: "Drain français autour des fondations avec gravier",
    descriptionEn: "Foundation drain with gravel surround",
    typicalLifespan: 30,
    category: "Building Sitework"
  },
  {
    code: "G30302",
    level: 4,
    parentCode: "G3030",
    nameFr: "Puisard et pompe",
    nameEn: "Sump Pit and Pump",
    descriptionFr: "Puisard avec pompe d'évacuation automatique",
    descriptionEn: "Sump pit with automatic ejector pump",
    typicalLifespan: 12,
    category: "Building Sitework"
  },

  // G401 - ELECTRICAL DISTRIBUTION
  {
    code: "G4010",
    level: 3,
    parentCode: "G40",
    nameFr: "Distribution électrique du site",
    nameEn: "Electrical Distribution",
    descriptionFr: "Distribution électrique externe au bâtiment",
    descriptionEn: "External electrical distribution",
    category: "Building Sitework"
  },
  {
    code: "G40101",
    level: 4,
    parentCode: "G4010",
    nameFr: "Entrée électrique souterraine",
    nameEn: "Underground Electrical Service",
    descriptionFr: "Conduit électrique souterrain du poteau au panneau",
    descriptionEn: "Underground electrical conduit from pole to panel",
    typicalLifespan: 35,
    category: "Building Sitework"
  },

  // G402 - SITE LIGHTING
  {
    code: "G4020",
    level: 3,
    parentCode: "G40",
    nameFr: "Éclairage extérieur",
    nameEn: "Site Lighting",
    descriptionFr: "Systèmes d'éclairage extérieur",
    descriptionEn: "Exterior lighting systems",
    category: "Building Sitework"
  },
  {
    code: "G40201",
    level: 4,
    parentCode: "G4020",
    nameFr: "Lampadaires DEL",
    nameEn: "LED Site Lighting",
    descriptionFr: "Lampadaires DEL avec détecteur de mouvement",
    descriptionEn: "LED site lighting with motion sensors",
    typicalLifespan: 15,
    category: "Building Sitework"
  }
];

// UTILITY FUNCTIONS

/**
 * Interface for hierarchical tree structure
 */
export interface UniformatTreeNode extends UniformatElement {
  children: UniformatTreeNode[];
}

/**
 * Build hierarchical tree structure from flat catalog
 */
export function buildUniformatTree(): UniformatTreeNode[] {
  const itemMap = new Map<string, UniformatTreeNode>();
  const rootItems: UniformatTreeNode[] = [];

  // Initialize all items with empty children arrays
  UNIFORMAT_CATALOG.forEach(item => {
    itemMap.set(item.code, { ...item, children: [] });
  });

  // Build the tree structure
  UNIFORMAT_CATALOG.forEach(item => {
    const node = itemMap.get(item.code);
    if (!node) return;

    if (item.parentCode) {
      const parent = itemMap.get(item.parentCode);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      // Root level item
      rootItems.push(node);
    }
  });

  return rootItems;
}

/**
 * Search UNIFORMAT catalog by text query (French or English)
 */
export function searchUniformatCatalog(query: string): UniformatElement[] {
  if (!query || query.length < 2) return [];

  const searchTerms = query.toLowerCase().split(' ');
  
  return UNIFORMAT_CATALOG.filter(item => {
    const searchableText = [
      item.code,
      item.nameFr,
      item.nameEn,
      item.descriptionFr,
      item.descriptionEn,
      item.category
    ].join(' ').toLowerCase();

    return searchTerms.every(term => searchableText.includes(term));
  });
}

/**
 * Get all children of a specific UNIFORMAT code
 */
export function getUniformatChildren(parentCode: string): UniformatElement[] {
  return UNIFORMAT_CATALOG.filter(item => item.parentCode === parentCode);
}

/**
 * Get the full hierarchy path for a given code
 */
export function getUniformatPath(code: string): UniformatElement[] {
  const path: UniformatElement[] = [];
  let currentCode = code;

  while (currentCode) {
    const item = UNIFORMAT_CATALOG.find(i => i.code === currentCode);
    if (!item) break;
    
    path.unshift(item);
    currentCode = item.parentCode || '';
  }

  return path;
}

/**
 * Get all Level 4 elements (leaf nodes) for a given parent
 */
export function getLevel4Elements(parentCode?: string): UniformatElement[] {
  return UNIFORMAT_CATALOG.filter(item => {
    if (item.level !== 4) return false;
    if (!parentCode) return true;
    
    // Check if this item is a descendant of parentCode
    const path = getUniformatPath(item.code);
    return path.some(p => p.code === parentCode);
  });
}

/**
 * Get elements by category
 */
export function getElementsByCategory(category: string): UniformatElement[] {
  return UNIFORMAT_CATALOG.filter(item => item.category === category);
}

/**
 * Get elements by typical lifespan range
 */
export function getElementsByLifespanRange(minYears: number, maxYears: number): UniformatElement[] {
  return UNIFORMAT_CATALOG.filter(item => 
    item.typicalLifespan && 
    item.typicalLifespan >= minYears && 
    item.typicalLifespan <= maxYears
  );
}

/**
 * Get statistics about the catalog
 */
export function getCatalogStatistics() {
  const stats = {
    totalElements: UNIFORMAT_CATALOG.length,
    byLevel: {} as Record<number, number>,
    byCategory: {} as Record<string, number>,
    avgLifespan: 0,
    lifespanRange: { min: 0, max: 0 }
  };

  let lifespanSum = 0;
  let lifespanCount = 0;
  let minLifespan = Infinity;
  let maxLifespan = 0;

  UNIFORMAT_CATALOG.forEach(item => {
    // Count by level
    stats.byLevel[item.level] = (stats.byLevel[item.level] || 0) + 1;
    
    // Count by category
    stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
    
    // Calculate lifespan statistics
    if (item.typicalLifespan) {
      lifespanSum += item.typicalLifespan;
      lifespanCount++;
      minLifespan = Math.min(minLifespan, item.typicalLifespan);
      maxLifespan = Math.max(maxLifespan, item.typicalLifespan);
    }
  });

  stats.avgLifespan = lifespanCount > 0 ? Math.round(lifespanSum / lifespanCount) : 0;
  stats.lifespanRange = { min: minLifespan === Infinity ? 0 : minLifespan, max: maxLifespan };

  return stats;
}

/**
 * Validate UNIFORMAT code format
 */
export function validateUniformatCode(code: string): boolean {
  const patterns = [
    /^[A-G]$/, // Level 1: Single letter
    /^[A-G][1-9]0$/, // Level 2: Letter + digit + 0
    /^[A-G][1-9][0-9][1-9]$/, // Level 3: Letter + 3 digits
    /^[A-G][1-9][0-9][1-9][0-9]$/ // Level 4: Letter + 4 digits
  ];
  
  return patterns.some(pattern => pattern.test(code));
}

/**
 * Get recommended replacement timeline for elements approaching end of life
 */
export function getReplacementTimeline(
  currentAge: number, 
  typicalLifespan: number, 
  warningThreshold: number = 0.8
): {
  status: 'good' | 'monitor' | 'plan' | 'urgent';
  yearsRemaining: number;
  recommendation: string;
} {
  const lifeRemaining = typicalLifespan - currentAge;
  const percentUsed = currentAge / typicalLifespan;

  if (percentUsed < 0.5) {
    return {
      status: 'good',
      yearsRemaining: lifeRemaining,
      recommendation: 'Element is in good condition. Continue routine maintenance.'
    };
  } else if (percentUsed < warningThreshold) {
    return {
      status: 'monitor',
      yearsRemaining: lifeRemaining,
      recommendation: 'Monitor condition more closely. Begin planning for eventual replacement.'
    };
  } else if (percentUsed < 1.0) {
    return {
      status: 'plan',
      yearsRemaining: lifeRemaining,
      recommendation: 'Plan replacement within the next few years. Budget accordingly.'
    };
  } else {
    return {
      status: 'urgent',
      yearsRemaining: lifeRemaining,
      recommendation: 'Element has exceeded typical lifespan. Replacement should be prioritized.'
    };
  }
}