import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	bloqueoPin: {
		beneficiario: r.one.beneficiario({
			from: r.bloqueoPin.beneficiarioId,
			to: r.beneficiario.id
		}),
		cobro: r.one.cobro({
			from: r.bloqueoPin.cobroId,
			to: r.cobro.id
		}),
		programa: r.one.programa({
			from: r.bloqueoPin.programaId,
			to: r.programa.id
		}),
	},
	beneficiario: {
		bloqueoPins: r.many.bloqueoPin(),
		cobros: r.many.cobro(),
		cuentaBeneficiarios: r.many.cuentaBeneficiario(),
	},
	cobro: {
		bloqueoPins: r.many.bloqueoPin(),
		beneficiario: r.one.beneficiario({
			from: r.cobro.beneficiarioId,
			to: r.beneficiario.id
		}),
		programa: r.one.programa({
			from: r.cobro.programaId,
			to: r.programa.id
		}),
		punto: r.one.punto({
			from: r.cobro.puntoId,
			to: r.punto.id
		}),
		cuentaBeneficiario: r.one.cuentaBeneficiario({
			from: [r.cobro.cuentaId, r.cobro.beneficiarioId],
			to: [r.cuentaBeneficiario.id, r.cuentaBeneficiario.beneficiarioId]
		}),
	},
	programa: {
		bloqueoPins: r.many.bloqueoPin(),
		cobros: r.many.cobro(),
		puntos: r.many.punto({
			from: r.programa.id.through(r.programaPunto.programaId),
			to: r.punto.id.through(r.programaPunto.puntoId)
		}),
	},
	punto: {
		cobros: r.many.cobro(),
		programas: r.many.programa(),
	},
	cuentaBeneficiario: {
		cobros: r.many.cobro(),
		beneficiario: r.one.beneficiario({
			from: r.cuentaBeneficiario.beneficiarioId,
			to: r.beneficiario.id
		}),
	},
}))