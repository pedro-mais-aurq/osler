import assert from 'node:assert/strict'

export async function testPublicCases({ db, one, asUser, rpc, teacher, otherTeacher, unverified, draft }) {
  const free = crypto.randomUUID(), other = crypto.randomUUID()
  for (const userId of [free, other]) {
    const email = `${userId}@public-practice.test`
    await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)', [userId, email, JSON.stringify({ full_name: 'Independent test student' })])
    await db.query("insert into auth.identities(user_id,provider,identity_data) values($1,'google',$2)", [userId, JSON.stringify({ email, email_verified: true })])
    await rpc(userId, 'teaching_bootstrap')
    await asUser(userId, "update public.students set course='nursing' where user_id=$1", [userId])
  }
  const classId = await rpc(teacher, 'teaching_save_classroom', [{ name: 'Optional participation', course: 'nursing', description: '', term: '2026' }, null])
  const teacherWorkspace = await rpc(teacher, 'teaching_workspace')
  const code = teacherWorkspace.classrooms.find(item => item.id === classId).joinCode
  assert.match(code, /^OSLER-[A-F0-9]{16}$/)
  assert.equal((await rpc(otherTeacher, 'teaching_workspace')).classrooms.some(item => item.id === classId), false)
  assert.equal((await one("select has_table_privilege('authenticated','private.classroom_join_codes','select') as allowed")).allowed, false)
  await assert.rejects(() => asUser(free, 'select * from private.classroom_join_codes'), /permission denied/)

  const publicId = await rpc(teacher, 'teaching_save_case', [{ ...draft, title: 'Public practice fixture', visibility: 'public' }, null, true])
  const privateId = await rpc(teacher, 'teaching_save_case', [{ ...draft, title: 'Private classroom fixture' }, null, true])
  const draftId = await rpc(teacher, 'teaching_save_case', [{ ...draft, title: 'Unpublished public fixture', visibility: 'public', reviewed: false }, null, false])
  assert.equal((await one('select visibility from public.clinical_cases where id=$1', [privateId])).visibility, 'private')
  await assert.rejects(() => rpc(teacher, 'teaching_save_case', [{ ...draft, visibility: 'invalid' }, null, true]), /visibilidade/)
  await assert.rejects(() => rpc(teacher, 'teaching_save_case', [{ ...draft, visibility: null }, null, true]), /visibilidade/)
  await assert.rejects(() => rpc(teacher, 'teaching_save_case', [{ ...draft, visibility: 'public', reviewed: false }, null, true]), /revisão/)
  await assert.rejects(() => rpc(teacher, 'teaching_save_case', [{ ...draft, visibility: 'private' }, publicId, true]), /preservada/)

  const catalogue = await rpc(free, 'public_case_catalogue', ['nursing'])
  assert(catalogue.cases.some(item => item.id === publicId))
  assert(!catalogue.cases.some(item => [privateId, draftId].includes(item.id)))
  assert.equal(catalogue.cases.find(item => item.id === publicId).stepCount, 2)
  assert.equal(JSON.stringify(catalogue).includes('Feedback Safe'), false)
  assert.equal(JSON.stringify(catalogue).includes('truth_model'), false)
  assert.equal((await rpc(free, 'student_workspace')).classrooms.length, 0)
  assert.equal((await asUser(free, 'select id from public.clinical_cases where id=$1', [privateId])).length, 0)
  assert.equal((await asUser(free, 'select id from public.case_steps where case_id=$1', [privateId])).length, 0)
  assert.equal((await asUser(free, 'select case_id from public.teaching_case_drafts where case_id=$1', [publicId])).length, 0)
  await assert.rejects(() => asUser(free, 'select * from public.case_step_rules'), /permission denied/)

  const start = async (userId, caseId, assignmentId = null) => (await asUser(userId, 'select * from public.start_or_resume_simulation_session($1,$2)', [caseId, assignmentId]))[0]
  await assert.rejects(() => start(free, privateId), /indisponível/)
  await assert.rejects(() => start(free, draftId), /indisponível/)
  const independent = await start(free, publicId)
  assert.equal((await start(free, publicId)).session_id, independent.session_id)
  assert.equal((await one('select assignment_id,classroom_student_email from public.simulation_sessions where id=$1', [independent.session_id])).classroom_student_email, null)
  assert.equal((await rpc(other, 'public_case_catalogue', ['nursing'])).attempts.length, 0)
  await assert.rejects(() => rpc(other, 'get_simulation_debrief', [independent.session_id]), /disponível/)

  await assert.rejects(() => rpc(free, 'student_join_classroom', ['bad-code']), /inválido/)
  await assert.rejects(() => rpc(unverified, 'student_join_classroom', [code]), /Google/)
  const joined = await rpc(free, 'student_join_classroom', [` ${code.toLowerCase()} `])
  assert.equal(joined.id, classId)
  assert.equal(joined.joinCode, undefined)
  await rpc(free, 'student_join_classroom', [code])
  const membership = await one('select count(*)::int as count from public.classroom_enrollments where classroom_id=$1 and student_id=$2', [classId, free])
  assert.equal(membership.count, 1)
  assert.equal((await rpc(free, 'student_workspace')).classrooms[0].joinCode, undefined)
  const activity = await rpc(teacher, 'teaching_assign_case', [classId, publicId, 'Classroom public case', null])
  const privateActivity = await rpc(teacher, 'teaching_assign_case', [classId, privateId, 'Private classroom case', null])
  assert.equal((await asUser(free, 'select id from public.clinical_cases where id=$1', [privateId])).length, 1)
  await assert.rejects(() => start(other, publicId, activity), /indisponível/)
  await assert.rejects(() => start(free, privateId), /indisponível/)
  assert((await start(free, privateId, privateActivity)).session_id)
  const classroom = await start(free, publicId, activity)
  assert.notEqual(classroom.session_id, independent.session_id)

  const enrollment = (await rpc(teacher, 'teaching_workspace')).enrollments.find(item => item.classroomId === classId && item.studentId === free)
  await rpc(teacher, 'teaching_revoke_enrollment', [enrollment.id])
  await assert.rejects(() => rpc(free, 'student_join_classroom', [code]), /revogado/)
  await assert.rejects(() => start(free, publicId, activity), /indisponível/)
  // Revoking a classroom membership must not revoke unrelated public practice.
  assert.equal((await start(free, publicId)).session_id, independent.session_id)
  const advanced = (await asUser(free, 'select * from public.advance_simulation_session($1,$2)', [independent.session_id, independent.current_step_id]))[0]
  await asUser(free, "select * from public.record_simulation_decision($1,$2,'safe')", [independent.session_id, advanced.current_step_id])
  const finished = (await asUser(free, 'select * from public.advance_simulation_session($1,$2)', [independent.session_id, advanced.current_step_id]))[0]
  assert.equal(finished.status, 'completed')
  const debrief = await rpc(free, 'get_simulation_debrief', [independent.session_id])
  assert.equal(debrief.session.score_total, 2)
  assert.equal(debrief.decisions.length, 1)
  assert.equal((await rpc(teacher, 'teaching_workspace')).attempts.some(item => item.id === independent.session_id), false)
  await assert.rejects(() => rpc(teacher, 'teaching_get_debrief', [independent.session_id]), /disponível/)
  await assert.rejects(() => rpc(teacher, 'teaching_save_feedback', [independent.session_id, 'Not a classroom attempt']), /disponível/)
  assert.equal((await asUser(teacher, 'select id from public.simulation_sessions where id=$1', [independent.session_id])).length, 0)
  const history = await rpc(free, 'public_case_catalogue', ['nursing'])
  assert.equal(history.attempts.find(item => item.id === independent.session_id).assignmentId, null)
  assert.equal(history.attempts.find(item => item.id === independent.session_id).caseId, publicId)
  assert.equal((await rpc(free, 'student_workspace')).attempts.some(item => item.id === independent.session_id), false)

  const stillActive = await start(free, publicId)
  await rpc(teacher, 'teaching_archive_case', [publicId])
  assert.equal((await rpc(free, 'public_case_catalogue', ['nursing'])).cases.some(item => item.id === publicId), false)
  await assert.rejects(() => start(free, publicId), /indisponível/)
  await assert.rejects(() => asUser(free, 'select * from public.advance_simulation_session($1,$2)', [stillActive.session_id, stillActive.current_step_id]), /indisponível/)
  await asUser(free, 'select * from public.abandon_simulation_session($1)', [stillActive.session_id])
  assert.equal((await rpc(free, 'get_simulation_debrief', [independent.session_id])).session.id, independent.session_id)
  await rpc(teacher, 'teaching_archive_classroom', [classId, true])
  await assert.rejects(() => rpc(other, 'student_join_classroom', [code]), /inválido/)

  for (const signature of ['private.teaching_save_case_p11(jsonb,uuid,boolean)', 'private.teaching_workspace_p11()']) {
    assert.equal((await one('select has_function_privilege($1,$2,$3) as allowed', ['authenticated', signature, 'execute'])).allowed, false)
  }
  const privateRls = await one("select rowsecurity from pg_tables where schemaname='private' and tablename='classroom_join_codes'")
  assert.equal(privateRls.rowsecurity, true)
  console.log('PASS explicit public/private visibility, draft isolation, public practice without enrollment, private case RLS, independent history privacy, separate classroom attempts, join-code authorization, idempotent enrollment, revoked and archived membership, and archived public-case history.')
}
