import { Injectable, Logger } from '@nestjs/common';

export interface RateLimitOptions {
    /** Nombre maximum de requêtes autorisées dans la fenêtre */
    maxRequests: number;
    /** Durée de la fenêtre en millisecondes */
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

/**
 * Service de rate limiting basé sur une fenêtre glissante en mémoire.
 *
 * Limites : ce service est local au process Node. Pour un déploiement
 * multi-instances, il faudrait remplacer la Map par un store partagé
 * (Redis). Suffisant pour le scope de ce projet.
 */
@Injectable()
export class RateLimitService {
    private readonly logger = new Logger(RateLimitService.name);
    private readonly hits = new Map<string, number[]>();

    /**
     * Vérifie si une requête est autorisée pour un client donné.
     * Enregistre la requête si elle l'est.
     */
    check(clientId: string, options: RateLimitOptions): RateLimitResult {
        const now = Date.now();
        const windowStart = now - options.windowMs;

        // Récupère et nettoie les timestamps dans la fenêtre
        const timestamps = (this.hits.get(clientId) ?? []).filter(
            (ts) => ts > windowStart,
        );

        if (timestamps.length >= options.maxRequests) {
            // Calcul : combien de temps avant que la plus vieille requête sorte de la fenêtre
            const oldestInWindow = timestamps[0];
            const retryAfterMs = oldestInWindow + options.windowMs - now;
            this.hits.set(clientId, timestamps);
            return {
                allowed: false,
                remaining: 0,
                retryAfterMs: Math.max(retryAfterMs, 0),
            };
        }

        timestamps.push(now);
        this.hits.set(clientId, timestamps);

        return {
            allowed: true,
            remaining: options.maxRequests - timestamps.length,
            retryAfterMs: 0,
        };
    }

    /** Réinitialise les compteurs (utile pour les tests). */
    reset(): void {
        this.hits.clear();
    }

    /** Pour tests : expose la taille du store. */
    size(): number {
        return this.hits.size;
    }
}