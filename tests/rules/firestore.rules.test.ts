import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore'

let env: RulesTestEnvironment

const PID = 'p1'
const users = {
  admin: 'admin',
  pm: 'pm',
  dev: 'dev',
  qa: 'qa',
  cliente: 'cliente',
  tester: 'tester',
  outsider: 'outsider',
  inactive: 'inactive',
} as const

function db(uid: string | null) {
  return uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore()
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-orion',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    const roles: Record<string, string> = {
      admin: 'admin', pm: 'project_manager', dev: 'dev', qa: 'qa', cliente: 'cliente', tester: 'tester',
      outsider: 'dev', inactive: 'project_manager',
    }
    for (const [uid, role] of Object.entries(roles)) {
      await setDoc(doc(fs, 'users', uid), {
        name: uid, email: `${uid}@orion.test`, globalRole: role, active: uid !== 'inactive',
      })
    }
    await setDoc(doc(fs, 'meta', 'counters'), { project: 1 })
    await setDoc(doc(fs, 'projects', PID), {
      number: 1, name: 'LaGuardiaGO', code: 'LGG', description: '', color: '#2563EB', favoriteBy: [],
      memberIds: ['pm', 'dev', 'qa', 'cliente', 'tester', 'inactive'], createdBy: 'pm', archived: false, briefMd: '',
      counters: { card: 1, round: 0, observation: 0 },
    })
    for (const [uid, role] of [['pm', 'project_manager'], ['dev', 'dev'], ['qa', 'qa'], ['cliente', 'cliente'], ['tester', 'tester'], ['inactive', 'project_manager']]) {
      await setDoc(doc(fs, 'projects', PID, 'members', uid!), { role })
    }
    await setDoc(doc(fs, 'projects', PID, 'cards', 'c1'), {
      number: 1, title: 'Tarjeta', column: 'por_hacer', order: 'V', createdBy: 'pm', archived: false,
    })
  })
})

describe('usuarios', () => {
  it('sin sesión no se lee nada', async () => {
    await assertFails(getDoc(doc(db(null), 'projects', PID)))
  })

  it('usuario inactivo no puede leer proyectos', async () => {
    await assertFails(getDoc(doc(db(users.inactive), 'projects', PID)))
  })

  it('un PM no puede crear admins, pero sí testers', async () => {
    await assertFails(setDoc(doc(db(users.pm), 'users', 'nuevo'), { name: 'x', email: 'x', globalRole: 'admin', active: true }))
    await assertSucceeds(setDoc(doc(db(users.pm), 'users', 'nuevo'), { name: 'x', email: 'x', globalRole: 'tester', active: true }))
  })

  it('un usuario solo puede cambiar su propio nombre', async () => {
    await assertSucceeds(updateDoc(doc(db(users.dev), 'users', 'dev'), { name: 'Dev 2' }))
    await assertFails(updateDoc(doc(db(users.dev), 'users', 'dev'), { globalRole: 'admin' }))
  })

  it('bootstrap del primer admin solo una vez', async () => {
    const fs = db('nuevoAdmin')
    const b = writeBatch(fs)
    b.set(doc(fs, 'users', 'nuevoAdmin'), { name: 'A', email: 'a', globalRole: 'admin', active: true })
    b.set(doc(fs, 'meta', 'bootstrap'), { uid: 'nuevoAdmin' })
    await assertSucceeds(b.commit())

    const fs2 = db('otro')
    const b2 = writeBatch(fs2)
    b2.set(doc(fs2, 'users', 'otro'), { name: 'B', email: 'b', globalRole: 'admin', active: true })
    b2.set(doc(fs2, 'meta', 'bootstrap'), { uid: 'otro' })
    await assertFails(b2.commit())
  })

  it('un usuario sin documento no puede auto-asignarse rol', async () => {
    await assertFails(setDoc(doc(db('intruso'), 'users', 'intruso'), { name: 'i', email: 'i', globalRole: 'dev', active: true }))
  })
})

describe('proyectos', () => {
  function newProjectBatch(uid: string) {
    const fs = db(uid)
    const b = writeBatch(fs)
    b.update(doc(fs, 'meta', 'counters'), { project: 2 })
    b.set(doc(fs, 'projects', 'p2'), {
      number: 2, name: 'YALEH', code: 'YLH', description: '', color: '#2563EB', favoriteBy: [],
      memberIds: [uid], createdBy: uid, archived: false, briefMd: '',
      counters: { card: 0, round: 0, observation: 0 },
    })
    b.set(doc(fs, 'projects', 'p2', 'members', uid), { role: 'project_manager' })
    return b
  }

  it('PM crea proyectos', async () => {
    await assertSucceeds(newProjectBatch(users.pm).commit())
  })

  it('dev no crea proyectos', async () => {
    await assertFails(newProjectBatch(users.dev).commit())
  })

  it('no miembro no lee el proyecto; miembro sí', async () => {
    await assertFails(getDoc(doc(db(users.outsider), 'projects', PID)))
    await assertSucceeds(getDoc(doc(db(users.dev), 'projects', PID)))
    await assertSucceeds(getDocs(query(collection(db(users.dev), 'projects'), where('memberIds', 'array-contains', 'dev'))))
  })

  it('admin lee cualquier proyecto', async () => {
    await assertSucceeds(getDoc(doc(db(users.admin), 'projects', PID)))
  })

  it('miembro marca su estrella, pero no la de otro ni renombra', async () => {
    await assertSucceeds(updateDoc(doc(db(users.dev), 'projects', PID), { favoriteBy: ['dev'] }))
    await assertFails(updateDoc(doc(db(users.dev), 'projects', PID), { favoriteBy: ['dev', 'qa'] }))
    await assertFails(updateDoc(doc(db(users.dev), 'projects', PID), { name: 'Otro' }))
    await assertSucceeds(updateDoc(doc(db(users.pm), 'projects', PID), { name: 'Otro' }))
  })

  it('solo PM gestiona miembros', async () => {
    await assertFails(setDoc(doc(db(users.dev), 'projects', PID, 'members', 'outsider'), { role: 'dev' }))
    await assertSucceeds(setDoc(doc(db(users.pm), 'projects', PID, 'members', 'outsider'), { role: 'dev' }))
  })
})

describe('tarjetas y flujo', () => {
  const card = (uid: string) => doc(db(uid), 'projects', PID, 'cards', 'c1')

  it('cliente lee el tablero pero no mueve', async () => {
    await assertSucceeds(getDoc(card(users.cliente)))
    await assertFails(updateDoc(card(users.cliente), { column: 'en_progreso' }))
  })

  it('tester no ve el tablero', async () => {
    await assertFails(getDoc(card(users.tester)))
  })

  it('dev mueve hasta QA pero no a humano ni a Hecho', async () => {
    await assertSucceeds(updateDoc(card(users.dev), { column: 'en_progreso' }))
    await assertSucceeds(updateDoc(card(users.dev), { column: 'revision_qa' }))
    await assertFails(updateDoc(card(users.dev), { column: 'revision_humano' }))
    await assertFails(updateDoc(card(users.dev), { column: 'hecho' }))
  })

  it('qa mueve QA <-> Por hacer/Humano', async () => {
    await assertFails(updateDoc(card(users.qa), { column: 'en_progreso' }))
    await assertSucceeds(updateDoc(card(users.qa), { column: 'revision_qa' }))
    await assertSucceeds(updateDoc(card(users.qa), { column: 'revision_humano' }))
    await assertFails(updateDoc(card(users.qa), { column: 'hecho' }))
  })

  it('solo PM mueve a Hecho', async () => {
    await assertSucceeds(updateDoc(card(users.pm), { column: 'hecho' }))
  })

  it('crear tarjeta exige consumir el contador', async () => {
    const fs = db(users.dev)
    const ok = writeBatch(fs)
    ok.update(doc(fs, 'projects', PID), { counters: { card: 2, round: 0, observation: 0 } })
    ok.set(doc(fs, 'projects', PID, 'cards', 'c2'), {
      number: 2, title: 'Nueva', column: 'backlog', order: 'a', createdBy: 'dev', archived: false,
    })
    await assertSucceeds(ok.commit())

    await assertFails(setDoc(doc(fs, 'projects', PID, 'cards', 'c3'), {
      number: 2, title: 'Duplicada', column: 'backlog', order: 'b', createdBy: 'dev', archived: false,
    }))
  })
})

describe('observaciones', () => {
  const obs = (uid: string, channel: string) => ({
    channel, kind: 'bug', title: 't', senderId: uid, senderName: uid, status: 'pendiente',
  })

  it('cliente solo crea en Clientes y tester solo en Testers', async () => {
    await assertSucceeds(setDoc(doc(db(users.cliente), 'projects', PID, 'observations', 'o1'), obs('cliente', 'clientes')))
    await assertFails(setDoc(doc(db(users.cliente), 'projects', PID, 'observations', 'o2'), obs('cliente', 'testers')))
    await assertSucceeds(setDoc(doc(db(users.tester), 'projects', PID, 'observations', 'o3'), obs('tester', 'testers')))
    await assertFails(setDoc(doc(db(users.tester), 'projects', PID, 'observations', 'o4'), obs('tester', 'clientes')))
  })

  it('solo PM aprueba', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects', PID, 'observations', 'o1'), obs('cliente', 'clientes'))
    })
    await assertFails(updateDoc(doc(db(users.dev), 'projects', PID, 'observations', 'o1'), { status: 'aprobada' }))
    await assertFails(updateDoc(doc(db(users.cliente), 'projects', PID, 'observations', 'o1'), { status: 'aprobada' }))
    await assertSucceeds(updateDoc(doc(db(users.pm), 'projects', PID, 'observations', 'o1'), { status: 'aprobada' }))
  })
})

describe('mensajes', () => {
  it('solo el destinatario lee sus mensajes', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'messages', 'm1'), { toUid: 'dev', fromUid: 'system', actorUid: 'pm', text: 'hola', read: false })
    })
    await assertSucceeds(getDoc(doc(db(users.dev), 'messages', 'm1')))
    await assertFails(getDoc(doc(db(users.qa), 'messages', 'm1')))
    await assertSucceeds(updateDoc(doc(db(users.dev), 'messages', 'm1'), { read: true }))
    await assertFails(updateDoc(doc(db(users.dev), 'messages', 'm1'), { text: 'x' }))
  })
})
