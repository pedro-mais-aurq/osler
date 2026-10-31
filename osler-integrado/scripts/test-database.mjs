// PostgreSQL/WASM checks. Auth primitives are stubbed; Google itself is not emulated.
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { testPublicCases } from './test-public-cases.mjs'
const db = new PGlite()
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text,identity_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `)
  for (const filename of (await readdir('supabase/migrations'))
    .filter((s) => s.endsWith('.sql'))
    .sort()) {
    const sql = (
      await readFile(`supabase/migrations/${filename}`, 'utf8')
    ).replace(
      /create extension if not exists pgcrypto with schema extensions;/,
      '-- gen_random_uuid is built into this PostgreSQL runtime.',
    )
    try {
      await db.exec(sql)
    } catch (error) {
      console.error(`Migration failed: ${filename}`)
      throw error
    }
    console.log(`PASS migration ${filename}`)
  }
  console.log('All migrations applied to isolated PostgreSQL.')
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]
  const asUser = async (userId, sql, params = []) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated')
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        userId,
      ])
      return (await tx.query(sql, params)).rows
    })
  const rpc = async (userId, name, args = []) =>
    (
      await asUser(
        userId,
        `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as value`,
        args,
      )
    )[0].value
  const userIds = Array.from({ length: 6 }, () => crypto.randomUUID())
  const [teacher, otherTeacher, student, outsider, unverified, lateStudent] =
    userIds
  const emails = [
    'teacher@example.com',
    'other@example.com',
    'student@example.com',
    'outsider@example.com',
    'unverified@example.com',
    'late@example.com',
  ]
  for (const [i, userId] of userIds.entries()) {
    await db.query(
      'insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',
      [
        userId,
        emails[i],
        JSON.stringify({ full_name: 'Test account', role: 'teacher' }),
      ],
    )
    await db.query(
      "insert into auth.identities(user_id,provider,identity_data) values($1,'google',$2)",
      [userId, JSON.stringify({ email: emails[i], email_verified: i !== 4 })],
    )
  }
  await db.query(
    'insert into private.teacher_allowlist(email) values($1),($2)',
    emails.slice(0, 2),
  )
  for (const [i, userId] of userIds.entries())
    if (i !== 4) await rpc(userId, 'teaching_bootstrap')
  assert.equal((await rpc(teacher, 'teaching_bootstrap')).role, 'teacher')
  assert.equal(
    (await rpc(outsider, 'teaching_bootstrap')).role,
    'student',
    'editable metadata must not grant a teacher role',
  )
  await assert.rejects(
    () => rpc(unverified, 'teaching_bootstrap'),
    /Google|confirmado/,
  )
  await assert.rejects(() => rpc(outsider, 'teaching_workspace'), /docente/)
  const classId = await rpc(teacher, 'teaching_save_classroom', [
    {
      name: 'Turma de teste',
      course: 'nursing',
      description: 'Teste',
      term: '2026.2',
    },
    null,
  ])
  await rpc(teacher, 'teaching_enroll', [
    classId,
    ['  STUDENT@EXAMPLE.COM  ', 'late@example.com', 'pending@example.com'],
  ])
  let workspace = await rpc(teacher, 'teaching_workspace')
  assert.equal(workspace.enrollments.length, 3)
  assert.equal(
    workspace.enrollments.find((e) => e.email === 'student@example.com').status,
    'active',
  )
  await assert.rejects(
    () =>
      rpc(otherTeacher, 'teaching_enroll', [classId, ['intruder@example.com']]),
    /indisponível/,
  )
  await assert.rejects(
    () =>
      rpc(teacher, 'teaching_enroll', [
        classId,
        ['valid@example.com', 'not an email'],
      ]),
    /inválido/,
  )
  assert.equal(
    (await rpc(teacher, 'teaching_workspace')).enrollments.length,
    3,
    'bulk enrollment must be atomic',
  )
  const option = (id, label, classification, scoreDelta) => ({
    id,
    label,
    classification,
    scoreDelta,
    feedback: `Feedback ${label}`,
    consequence: 'Consequence',
    presentationState: 'stable',
    nextStepKey: 'next',
  })
  const draft = {
    title: 'Deterministic authoring test',
    course: 'nursing',
    description: 'Software validation case',
    objective: 'Test the engine',
    patientName: 'Fictional Patient',
    patientAge: 40,
    pronouns: 'ela/dela',
    reference: 'Test reference',
    reviewed: true,
    steps: [
      {
        key: 'intro',
        type: 'information',
        title: 'Introduction',
        body: 'Visible body',
        observations: [],
        presentationState: 'stable',
        options: [],
      },
      {
        key: 'decision',
        type: 'decision',
        title: 'Decision',
        body: 'Choose',
        observations: [],
        presentationState: 'stable',
        options: [
          option('safe', 'Safe', 'ideal', 2),
          option('risk', 'Risk', 'unsafe', -1),
        ],
      },
    ],
  }
  await assert.rejects(
    () =>
      rpc(teacher, 'teaching_save_case', [
        { ...draft, reviewed: false },
        null,
        true,
      ]),
    /revisão/,
  )
  const partial = {
    ...draft,
    title: 'Partial draft',
    description: '',
    objective: '',
    patientName: '',
    reviewed: false,
    steps: [],
  }
  const partialId = await rpc(teacher, 'teaching_save_case', [
    partial,
    null,
    false,
  ])
  await assert.rejects(
    () => rpc(teacher, 'teaching_save_case', [partial, partialId, true]),
    /contexto|etapas|revisão/,
  )
  const caseId = await rpc(teacher, 'teaching_save_case', [draft, null, false])
  await assert.rejects(
    () =>
      rpc(teacher, 'teaching_assign_case', [
        classId,
        caseId,
        'Unpublished',
        null,
      ]),
    /publicado/,
  )
  await rpc(teacher, 'teaching_save_case', [draft, caseId, true])
  const assignmentId = await rpc(teacher, 'teaching_assign_case', [
    classId,
    caseId,
    'Exercise',
    null,
  ])
  const assignment2 = await rpc(teacher, 'teaching_assign_case', [
    classId,
    caseId,
    'Second exercise',
    null,
  ])
  await assert.rejects(
    () => rpc(otherTeacher, 'teaching_save_case', [draft, caseId, false]),
    /indisponível/,
  )
  await assert.rejects(
    () =>
      rpc(teacher, 'teaching_save_case', [
        { ...draft, title: 'Changed' },
        caseId,
        true,
      ]),
    /preservada/,
  )
  assert.equal(
    (
      await asUser(
        outsider,
        'select * from public.clinical_cases where id=$1',
        [caseId],
      )
    ).length,
    0,
  )
  assert.equal(
    (
      await asUser(student, 'select * from public.clinical_cases where id=$1', [
        caseId,
      ])
    ).length,
    1,
  )
  assert.equal(
    (await asUser(student, 'select * from public.teaching_case_drafts')).length,
    0,
  )
  await assert.rejects(
    () => asUser(student, 'select * from public.case_step_rules'),
    /permission denied/,
  )
  await assert.rejects(
    () =>
      asUser(student, 'select private.build_simulation_debrief($1,$2)', [
        crypto.randomUUID(),
        student,
      ]),
    /permission denied/,
  )
  await assert.rejects(
    () =>
      asUser(
        student,
        "insert into public.classrooms(teacher_id,name,course) values($1,'Fake','nursing')",
        [student],
      ),
    /permission denied/,
  )
  await db.query(
    "update public.students set course='nursing' where user_id in ($1,$2)",
    [student, outsider],
  )
  await assert.rejects(
    () =>
      rpc(outsider, 'start_or_resume_simulation_session', [
        caseId,
        assignmentId,
      ]),
    /indisponível/,
  )
  await assert.rejects(
    () => rpc(student, 'start_or_resume_simulation_session', [caseId]),
    /indisponível/,
  )
  await rpc(teacher, 'teaching_archive_classroom', [classId, true])
  assert.equal((await asUser(student, 'select * from public.classroom_assignments where classroom_id=$1', [classId])).length, 0, 'archived classrooms must not expose activities to students')
  await rpc(teacher, 'teaching_archive_classroom', [classId, false])
  const privateStep = await one("select id from public.case_steps where case_id=$1 and step_type='decision'", [caseId])
  await assert.rejects(() => rpc(student, 'evaluate_case_step', [caseId, privateStep.id, 'safe']), /atividade/)
  await assert.rejects(() => rpc(student, 'resolve_simulation_transition', [caseId, privateStep.id, 'safe']), /atividade/)
  await assert.rejects(() => asUser(student, 'select * from private.resolve_simulation_transition_internal($1,$2,$3)', [caseId, privateStep.id, 'safe']), /permission denied/)
  // Record RPCs return TABLE, so query them directly to preserve their shape.
  const start = async (activity) =>
    (
      await asUser(
        student,
        'select * from public.start_or_resume_simulation_session($1,$2)',
        [caseId, activity],
      )
    )[0]
  const session = await start(assignmentId)
  assert.equal(
    (await start(assignmentId)).session_id,
    session.session_id,
    'start must resume the same activity',
  )
  assert.notEqual(
    (await start(assignment2)).session_id,
    session.session_id,
    'the same case in two activities needs independent attempts',
  )
  let advanced = (
    await asUser(
      student,
      'select * from public.advance_simulation_session($1,$2)',
      [session.session_id, session.current_step_id],
    )
  )[0]
  const decisionStepId = advanced.current_step_id
  await rpc(teacher, 'teaching_set_assignment_status', [assignmentId, 'closed'])
  await assert.rejects(
    () =>
      asUser(
        student,
        "select * from public.record_simulation_decision($1,$2,'safe')",
        [session.session_id, decisionStepId],
      ),
    /indisponível/,
  )
  await rpc(teacher, 'teaching_set_assignment_status', [assignmentId, 'open'])
  const decision = (
    await asUser(
      student,
      "select * from public.record_simulation_decision($1,$2,'safe')",
      [session.session_id, decisionStepId],
    )
  )[0]
  assert.equal(decision.score_total, 2)
  assert.equal(
    (
      await asUser(
        student,
        "select * from public.record_simulation_decision($1,$2,'safe')",
        [session.session_id, decisionStepId],
      )
    )[0].replayed,
    true,
  )
  advanced = (
    await asUser(
      student,
      'select * from public.advance_simulation_session($1,$2)',
      [session.session_id, decisionStepId],
    )
  )[0]
  assert.equal(advanced.status, 'completed')
  const debrief = await rpc(teacher, 'teaching_get_debrief', [
    session.session_id,
  ])
  assert.equal(debrief.email, 'student@example.com')
  assert.equal(debrief.debrief.decisions[0].feedback, 'Feedback Safe')
  assert.equal(JSON.stringify(debrief).includes('truth_model'), false)
  assert.equal(JSON.stringify(debrief).includes('rules'), false)
  await assert.rejects(
    () => rpc(otherTeacher, 'teaching_get_debrief', [session.session_id]),
    /disponível/,
  )
  await assert.rejects(
    () => rpc(outsider, 'get_simulation_debrief', [session.session_id]),
    /disponível/,
  )
  await rpc(teacher, 'teaching_save_feedback', [
    session.session_id,
    'Review the next step together.',
  ])
  const studentWorkspace = await rpc(student, 'student_workspace')
  assert.equal(
    studentWorkspace.attempts.find((a) => a.id === session.session_id).feedback,
    'Review the next step together.',
  )
  assert.equal(
    JSON.stringify(studentWorkspace).includes('scoreDelta'),
    false,
    'student workspace must not expose answer rules',
  )
  const enrollment = (
    await rpc(teacher, 'teaching_workspace')
  ).enrollments.find((e) => e.email === 'student@example.com')
  await rpc(teacher, 'teaching_revoke_enrollment', [enrollment.id])
  await rpc(student, 'teaching_bootstrap')
  assert.equal(
    (await rpc(student, 'student_workspace')).assignments.length,
    0,
    'bootstrap must not resurrect a revoked enrollment',
  )
  await assert.rejects(() => start(assignment2), /indisponível/)
  assert.equal(
    (await rpc(student, 'get_simulation_debrief', [session.session_id])).session
      .id,
    session.session_id,
    'own completed history survives removal',
  )
  assert.equal(
    (await rpc(teacher, 'teaching_get_debrief', [session.session_id])).debrief
      .session.id,
    session.session_id,
    'teacher retains submitted classroom history',
  )
  await rpc(teacher, 'teaching_enroll', [classId, ['student@example.com']])
  await db.query(
    "update auth.users set email='changed@example.com' where id=$1",
    [student],
  )
  assert.equal(
    (
      await asUser(student, 'select * from public.clinical_cases where id=$1', [
        caseId,
      ])
    ).length,
    0,
    'email changes must invalidate the old enrollment',
  )
  await assert.rejects(() => start(assignment2), /indisponível/)
  assert.equal(
    (await rpc(teacher, 'teaching_get_debrief', [session.session_id])).email,
    'student@example.com',
    'teacher reports keep the email submitted with the attempt',
  )
  await testPublicCases({ db, one, asUser, rpc, teacher, otherTeacher, unverified, draft })
  await db.query(
    'update private.teacher_allowlist set enabled=false where email=$1',
    [emails[0]],
  )
  await assert.rejects(() => rpc(teacher, 'teaching_workspace'), /docente/)
  const security = await one(
    "select count(*)::int as missing from pg_tables where schemaname='public' and not rowsecurity",
  )
  assert.equal(security.missing, 0, 'all exposed tables require RLS')
  console.log(
    'PASS Google trust boundary, teacher allowlist, classroom isolation, normalized and atomic enrollment, draft review, immutable publication, answer privacy, separate activity attempts, idempotency, closed-activity enforcement, historical debrief, feedback, revoked access and email changes.',
  )
} finally {
  await db.close()
}
