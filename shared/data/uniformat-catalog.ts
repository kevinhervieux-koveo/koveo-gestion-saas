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
    category: "Substructure"
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
    category: "Substructure"
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
    category: "Substructure"
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
    category: "Substructure"
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
    category: "Substructure"
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
    category: "Substructure"
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
    category: "Substructure"
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
    category: "Substructure"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Shell"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Interiors"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Services"
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
    category: "Equipment & Furnishings"
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
    category: "Equipment & Furnishings"
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
    category: "Equipment & Furnishings"
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
    category: "Equipment & Furnishings"
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
    category: "Equipment & Furnishings"
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
    category: "Special Construction & Demolition"
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
    category: "Special Construction & Demolition"
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
    category: "Special Construction & Demolition"
  },
  {
    code: "F2020",
    level: 3,
    parentCode: "F20",
    nameFr: "Démolition extérieure",
    nameEn: "Exterior Demolition",
    descriptionFr: "Démolition sélective d'éléments extérieurs",
    descriptionEn: "Selective demolition of exterior elements",
    category: "Special Construction & Demolition"
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
    category: "Building Sitework"
  },
  {
    code: "G1020",
    level: 3,
    parentCode: "G10",
    nameFr: "Excavation",
    nameEn: "Excavation",
    descriptionFr: "Travaux d'excavation et terrassement",
    descriptionEn: "Excavation and earthwork",
    category: "Building Sitework"
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
    category: "Building Sitework"
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
    category: "Building Sitework"
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
    category: "Building Sitework"
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
    category: "Building Sitework"
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
    category: "Building Sitework"
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
    category: "Building Sitework"
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
    category: "Building Sitework"
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
    category: "Building Sitework"
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
    category: "Building Sitework"
  },
];