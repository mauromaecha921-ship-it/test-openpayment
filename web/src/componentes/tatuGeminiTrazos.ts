// Poses del tatú dibujadas por Gemini (opción D de /demo/tatu), a trazo. Los colores no van aquí:
// el trazo usa el color del texto y el relleno el de la superficie, para el modo claro y el oscuro.

export const VIEWBOX_GEMINI = '0 0 240 200'

export interface Trazo {
  d: string
  /** true: forma cerrada que tapa lo de atrás; false: solo línea. */
  relleno: boolean
  grosor: number
}

/** 0 camina · 1 se agacha · 2 se encorva · 3 bolita. */
export const CUADROS_GEMINI: readonly (readonly Trazo[])[] = [
  // camina (patas, cola, caparazón con bandas, cabeza)
  [
    { d: 'M 95 129 L 104 148 L 118 148 C 119 143 113 141 109 141 L 104 127 Z', relleno: true, grosor: 6.5 },
    { d: 'M 152 124 L 164 141 L 176 141 C 177 136 172 134 167 134 L 160 119 Z', relleno: true, grosor: 6.5 },
    { d: 'M 70 111 C 54 123 36 134 16 139 C 37 144 58 139 76 128 Z', relleno: true, grosor: 6.5 },
    { d: 'M 35 133 C 37 137 39 140 39 142', relleno: false, grosor: 5.52 },
    { d: 'M 48 126 C 51 131 53 136 53 139', relleno: false, grosor: 5.52 },
    { d: 'M 60 118 C 64 124 66 130 66 134', relleno: false, grosor: 5.52 },
    { d: 'M 74 125 L 64 152 L 84 152 C 85 146 78 144 74 144 L 86 129 Z', relleno: true, grosor: 6.5 },
    { d: 'M 136 124 L 146 152 L 165 152 C 166 146 159 144 155 144 L 149 124 Z', relleno: true, grosor: 6.5 },
    { d: 'M 68 112 C 74 78 104 66 134 68 C 154 69 168 78 173 91 C 166 112 155 125 144 127 C 122 132 95 131 68 112 Z', relleno: true, grosor: 6.5 },
    { d: 'M 98 73 C 90 92 91 112 97 126', relleno: false, grosor: 6.5 },
    { d: 'M 113 69 C 105 90 106 114 112 129', relleno: false, grosor: 6.5 },
    { d: 'M 129 68 C 120 90 121 115 128 129', relleno: false, grosor: 6.5 },
    { d: 'M 146 72 C 139 92 141 113 148 126', relleno: false, grosor: 6.5 },
    { d: 'M 178 85 C 184 70 194 64 198 67 C 200 72 194 86 185 93 Z', relleno: true, grosor: 6.5 },
    { d: 'M 164 87 C 179 84 194 95 200 116 C 203 125 204 133 199 136 C 193 138 182 131 171 122 C 163 116 157 113 153 116', relleno: true, grosor: 6.5 },
    { d: 'M 169 89 C 161 73 160 59 165 57 C 171 57 181 70 180 87', relleno: true, grosor: 6.5 },
    { d: 'M 168 67 C 171 73 173 79 173 85', relleno: false, grosor: 4.88 },
    { d: 'M 179 104 L 186 113', relleno: false, grosor: 5.85 },
  ],
  // se agacha
  [
    { d: 'M 66 96 C 50 105 34 111 20 110 C 34 121 54 121 72 113 Z', relleno: true, grosor: 6.5 },
    { d: 'M 38 109 C 39 113 41 116 42 118', relleno: false, grosor: 5.2 },
    { d: 'M 52 104 C 54 109 56 114 57 117', relleno: false, grosor: 5.2 },
    { d: 'M 73 112 L 85 138 L 99 142 C 101 137 96 133 91 131 L 86 116 Z', relleno: true, grosor: 6.5 },
    { d: 'M 96 120 L 108 142 L 121 144 C 122 139 117 135 113 134 L 108 120 Z', relleno: true, grosor: 6.5 },
    { d: 'M 122 124 L 135 151 L 149 154 C 150 148 145 144 140 143 L 136 123 Z', relleno: true, grosor: 6.5 },
    { d: 'M 65 96 C 72 58 106 46 139 54 C 161 59 176 74 180 94 C 168 118 151 128 134 127 C 110 126 84 118 65 96 Z', relleno: true, grosor: 6.5 },
    { d: 'M 99 54 C 89 76 89 99 95 117', relleno: false, grosor: 6.5 },
    { d: 'M 116 51 C 104 75 103 102 109 122', relleno: false, grosor: 6.5 },
    { d: 'M 134 53 C 119 78 117 105 123 125', relleno: false, grosor: 6.5 },
    { d: 'M 152 60 C 136 84 134 109 139 126', relleno: false, grosor: 6.5 },
    { d: 'M 183 102 C 194 94 205 92 208 96 C 207 103 197 112 184 114 Z', relleno: true, grosor: 6.5 },
    { d: 'M 164 96 C 180 98 190 115 188 138 C 187 151 185 160 179 161 C 172 162 164 152 158 138 C 154 128 151 120 145 121', relleno: true, grosor: 6.5 },
    { d: 'M 169 99 C 165 82 168 68 174 67 C 180 69 185 84 180 100', relleno: true, grosor: 6.5 },
    { d: 'M 173 77 C 175 84 175 91 174 96', relleno: false, grosor: 4.88 },
    { d: 'M 171 122 L 174 133', relleno: false, grosor: 5.85 },
  ],
  // se encorva
  [
    { d: 'M 74 115 C 72 132 84 146 102 146 C 114 146 124 138 128 128', relleno: true, grosor: 6.5 },
    { d: 'M 88 118 C 90 131 102 138 117 135', relleno: false, grosor: 6.5 },
    { d: 'M 102 112 C 106 125 118 130 131 125', relleno: false, grosor: 6.5 },
    { d: 'M 78 124 C 62 116 58 96 68 80 C 66 64 78 46 98 42 C 112 34 136 36 152 48 C 174 56 186 78 184 104 C 168 118 144 122 126 112 C 114 105 104 106 96 118 C 90 125 83 127 78 124 Z', relleno: true, grosor: 6.5 },
    { d: 'M 68 80 C 80 86 92 98 98 114', relleno: false, grosor: 6.5 },
    { d: 'M 98 42 C 102 64 106 88 112 108', relleno: false, grosor: 6.5 },
    { d: 'M 152 48 C 132 62 122 86 124 110', relleno: false, grosor: 6.5 },
    { d: 'M 176 68 C 154 74 138 90 136 114', relleno: false, grosor: 6.5 },
    { d: 'M 178 122 C 190 120 202 122 204 126 C 200 133 188 138 174 136 Z', relleno: true, grosor: 6.5 },
    { d: 'M 152 108 C 170 112 178 130 168 148 C 160 160 146 168 138 166 C 132 164 134 152 138 138 C 141 126 144 114 152 108 Z', relleno: true, grosor: 6.5 },
    { d: 'M 162 114 C 166 98 176 86 182 88 C 186 92 182 108 172 120', relleno: true, grosor: 6.5 },
    { d: 'M 176 96 C 174 103 171 109 167 114', relleno: false, grosor: 4.88 },
    { d: 'M 154 135 L 148 145', relleno: false, grosor: 5.85 },
  ],
  // bolita: gira entera alrededor de (120, 104)
  [
    { d: 'M 60 104 A 60 60 0 1 0 180 104 A 60 60 0 1 0 60 104 Z', relleno: true, grosor: 6.5 },
    { d: 'M 96 49 C 98 68 106 82 120 88', relleno: false, grosor: 6.5 },
    { d: 'M 138 47 C 126 64 122 80 126 92', relleno: false, grosor: 6.5 },
    { d: 'M 171 72 C 148 74 134 84 130 98', relleno: false, grosor: 6.5 },
    { d: 'M 177 118 C 158 102 140 98 126 104', relleno: false, grosor: 6.5 },
    { d: 'M 75 65 C 68 92 80 116 106 118 C 122 119 132 112 132 103 C 132 94 122 89 109 92 C 95 95 86 84 89 68', relleno: true, grosor: 6.5 },
    { d: 'M 134 156 C 146 161 158 161 161 157 C 159 151 149 146 138 147 Z', relleno: true, grosor: 6.5 },
    { d: 'M 142 128 C 126 122 108 126 92 136 C 82 142 78 148 82 153 C 88 159 106 163 124 160 C 138 158 148 148 148 136 Z', relleno: true, grosor: 6.5 },
    { d: 'M 134 134 C 144 126 155 121 159 124 C 160 130 151 141 138 146', relleno: true, grosor: 6.5 },
    { d: 'M 116 144 L 104 146', relleno: false, grosor: 5.85 },
  ],
]
