"""Simulazione della fila al semaforo (regole di Paolo, 11/11/2026).

40 auto lunghe 4,5 m, ferme a 2 m l'una dall'altra; tutte vanno al massimo a 10 km/h, accelerano a 1,5 m/s²
e frenano a 2 m/s². Il verde dura 90 s; quando scatta il rosso chi non ha passato la linea si ferma in fila.

  'oggi'     il primo guarda il telefono e parte dopo 3 s; ognuno parte 1 s dopo quello davanti
  'insieme'  tutti guardano il semaforo e partono insieme dopo 0,5 s, come vagoni di un treno

Le distanze sono in metri DIETRO la linea d'arresto (0 = muso sulla linea, negativo = gia' passata).

    python -I sim.py      # stampa i numeri del video
"""
import numpy as np

N = 40
L_AUTO = 4.5
DIST = 2.0
PASSO = L_AUTO + DIST
VMAX = 10 / 3.6
ACC = 1.5
FRENO = 2.0
VERDE = 90.0
TU = 29                       # indice dell'auto «tu» (la 30ª)
DT = 1 / 120
T_FINE = 130.0

PARTENZE = {
    'oggi': 3.0 + 1.0 * np.arange(N),
    'insieme': np.full(N, 0.5),
}


def _libera(dist0, partenza, t):
    """Distanza dietro la linea senza rosso: accelera fino a VMAX e poi va costante."""
    tau = np.maximum(0.0, t - partenza)
    ta = VMAX / ACC
    s = np.where(tau < ta, 0.5 * ACC * tau ** 2, 0.5 * ACC * ta ** 2 + VMAX * (tau - ta))
    return dist0 - s


def passaggi_liberi(scenario):
    """Istante in cui ogni auto passerebbe la linea se il verde non finisse mai."""
    p = PARTENZE[scenario]
    ta, sa = VMAX / ACC, VMAX ** 2 / (2 * ACC)
    d = np.arange(N) * PASSO
    return p + np.where(d <= sa, np.sqrt(2 * d / ACC), ta + (d - sa) / VMAX)


def traiettorie(scenario):
    """Matrice [tempo, auto] delle distanze dietro la linea, passo DT, da 0 a T_FINE, con il rosso a VERDE."""
    p = PARTENZE[scenario]
    pas = passaggi_liberi(scenario)
    passate = int(np.sum(pas <= VERDE))
    target = np.full(N, -np.inf)
    target[passate:] = (np.arange(N - passate)) * PASSO     # posti nella nuova fila dietro la linea
    t = np.arange(0, T_FINE + DT, DT)
    out = np.empty((len(t), N))
    d = np.arange(N) * PASSO
    v = np.zeros(N)
    for i, ti in enumerate(t):
        out[i] = d
        partita = ti >= p
        v_new = np.where(partita, np.minimum(VMAX, v + ACC * DT), 0.0)
        if ti >= VERDE:                                     # rosso: chi non e' passato frena per fermarsi al suo posto
            resto = np.maximum(0.0, d - target)
            v_new = np.where(np.isfinite(target), np.minimum(v_new, np.sqrt(2 * FRENO * resto)), v_new)
        d = np.maximum(d - v_new * DT, target)                 # nessuno supera il suo posto in fila
        v = v_new
    return t, out


def conta_passate(traj_t, traj, t):
    i = min(len(traj_t) - 1, max(0, int(round(t / DT))))
    return int(np.sum(traj[i] < 0))


if __name__ == '__main__':
    for sc in ('oggi', 'insieme'):
        pas = passaggi_liberi(sc)
        t, tr = traiettorie(sc)
        print(f'{sc}: passano col verde {int(np.sum(pas <= VERDE))} auto (contate in traiettoria: {conta_passate(t, tr, VERDE)});'
              f' tu (30ª, a {TU * PASSO:.1f} m) parte a {PARTENZE[sc][TU]:.1f} s, passerebbe a {pas[TU]:.1f} s;'
              f' al rosso sei a {tr[int(VERDE / DT), TU]:.1f} m; distanza minima tra auto {np.min(np.diff(-tr, axis=1)) * -1 - L_AUTO:.2f} m')
