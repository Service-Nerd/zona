// STRENGTH-ENGINE-01 — the exercise catalogue (ADR-024 §4).
//
// Exercises are FIXED; sets, reps, load and rest are NOT here. They come from the
// prescription model (prescription.ts), which is how "sometimes high reps,
// sometimes heavy" happens without the catalogue knowing.
//
// ✅ REVIEW STATUS: REVIEWED by the strength seat, 2026-10-17 (Coaching Board, CORRECT WITH
// AMENDMENT: `docs/decisions/strength-catalogue-review-2026-10-17.md`). Authored with AI
// assistance (ADR-024 §6b); 13 corrections landed at the sitting. A cue is runner-facing
// copy: brand voice, no em dashes, no effort numbers (the dose line owns RIR), no outcome claim.
// `media.animation_id` is a placeholder until Phase 3 licenses the animations.

import type { EquipmentTag, Exercise, InjuryTag, Muscle, Pattern } from './types'

export const CATALOGUE_REVIEW_STATUS = 'reviewed' as const

const BW: EquipmentTag[][] = [['bodyweight']]
const LOAD: EquipmentTag[][] = [['dumbbells'], ['kettlebell']]
const BAND: EquipmentTag[][] = [['bands']]

function ex(
  id: string, name: string, pattern: Pattern, muscles: Muscle[], equipment: EquipmentTag[][],
  level: 1 | 2 | 3, opts: {
    uni?: boolean; impact?: 'none' | 'low' | 'high'; avoid?: InjuryTag[]; flex?: boolean
    measure?: 'reps' | 'seconds' | 'contacts'; regress?: string; progress?: string; notMain?: boolean; bw?: boolean
  }, cues: string[],
): Exercise {
  return {
    id, name, pattern, muscles, equipment, level,
    unilateral: opts.uni ?? false,
    impact: opts.impact ?? 'none',
    ...(opts.flex ? { spinal_flexion_loaded: true } : {}),
    avoid_with: opts.avoid ?? [],
    measure: opts.measure ?? 'reps',
    ...(opts.regress ? { regress_to: opts.regress } : {}),
    ...(opts.progress ? { progress_to: opts.progress } : {}),
    ...(opts.notMain ? { not_main: true } : {}),
    ...(opts.bw ? { bodyweight: true as const } : {}),
    media: { animation_id: id },
    cues,
  }
}

export const CATALOGUE: readonly Exercise[] = [
  // ── Warm-up (RAMP: raise, activate, mobilise, potentiate) ──
  ex('marching_high_knees', 'Marching high knees', 'warmup', ['hip_flexors', 'full_body'], BW, 1, { measure: 'seconds' }, ['Tall posture.', 'Drive the knee, land quietly.']),
  ex('leg_swings', 'Leg swings', 'warmup', ['hip_flexors', 'hamstrings'], BW, 1, { uni: true }, ['Hold something steady.', 'Swing, do not fling.']),
  ex('hip_circles', 'Standing hip circles', 'warmup', ['glutes', 'hip_flexors'], BW, 1, { uni: true }, ['Slow and wide.', 'Keep the standing knee soft.']),
  ex('glute_bridge_activation', 'Glute bridge hold', 'warmup', ['glutes'], BW, 1, { measure: 'seconds' }, ['Squeeze, then lift.', 'Ribs down, no arching.']),
  { ...ex('band_walk_warmup', 'Banded side steps', 'warmup', ['hip_abductors'], BAND, 1, {}, ['Small steps, constant tension.', 'Toes forward.']), same_as: 'banded_side_step' },
  ex('worlds_greatest_stretch', "World's greatest stretch", 'warmup', ['hip_flexors', 'hamstrings', 'back'], BW, 1, { uni: true }, ['Long lunge, elbow to instep.', 'Rotate up and breathe.']),
  ex('inchworm', 'Inchworm', 'warmup', ['hamstrings', 'core', 'shoulders'], BW, 1, {}, ['Walk the hands out to a plank.', 'Walk the feet in, legs as straight as is comfortable.']),
  ex('ankle_rocks', 'Knee-to-wall ankle rocks', 'warmup', ['calves', 'soleus'], BW, 1, { uni: true }, ['Heel stays down.', 'Knee tracks over the middle toe.']),
  ex('a_skip', 'A-skip', 'warmup', ['hip_flexors', 'calves'], BW, 2, { impact: 'low', avoid: ['achilles', 'plantar'] }, ['Quick, light contacts.', 'Opposite arm, opposite knee.']),
  ex('goblet_squat_ramp', 'Ramp set: light goblet squat', 'warmup', ['quads', 'glutes'], LOAD, 1, {}, ['Lighter than your work sets.', 'Find the depth you will use.']),

  // ── Squat ──
  ex('box_squat_bw', 'Box squat (bodyweight)', 'squat', ['quads', 'glutes'], [['box'], ['bench'], ['bodyweight']], 1, { progress: 'goblet_squat' }, ['Sit back to a box or chair, do not crash.', 'Stand up through the whole foot.']),
  ex('tempo_squat_bw', 'Tempo squat (bodyweight)', 'squat', ['quads', 'glutes'], BW, 1, { progress: 'goblet_squat' }, ['Three seconds down.', 'Knees follow the toes.']),
  ex('banded_squat', 'Banded squat', 'squat', ['quads', 'glutes'], BAND, 1, { progress: 'goblet_squat' }, ['Band under the feet, over the shoulders.', 'Push the floor away.']),
  ex('goblet_squat', 'Goblet squat', 'squat', ['quads', 'glutes'], LOAD, 2, { regress: 'tempo_squat_bw', progress: 'front_squat' }, ['Weight at the chest, elbows down.', 'Sit between the heels.']),
  ex('dumbbell_box_squat', 'Dumbbell box squat', 'squat', ['quads', 'glutes'], [['dumbbells', 'box'], ['dumbbells', 'bench']], 2, { regress: 'box_squat_bw' }, ['Touch, do not rest.', 'Same depth every rep.']),
  ex('front_squat', 'Front squat', 'squat', ['quads', 'glutes', 'core'], [['barbell', 'rack']], 3, { regress: 'goblet_squat', avoid: ['back'] }, ['Elbows high.', 'Stay tall out of the hole.']),
  ex('back_squat', 'Back squat', 'squat', ['quads', 'glutes'], [['barbell', 'rack']], 3, { regress: 'goblet_squat', avoid: ['back'] }, ['Brace before you descend.', 'Drive up, chest and hips together.']),
  ex('leg_press', 'Leg press', 'squat', ['quads', 'glutes'], [['machines']], 2, {}, ['Lower back stays on the pad.', 'Do not lock the knees out hard.']),

  // ── Hinge ──
  ex('glute_bridge', 'Glute bridge', 'hinge', ['glutes', 'hamstrings'], BW, 1, { progress: 'single_leg_glute_bridge' }, ['Heels close to the hips.', 'Pause at the top.']),
  ex('single_leg_glute_bridge', 'Single-leg glute bridge', 'hinge', ['glutes', 'hamstrings'], BW, 2, { uni: true, regress: 'glute_bridge' }, ['Hips level.', 'Push through the heel.']),
  ex('band_good_morning', 'Banded good morning', 'hinge', ['hamstrings', 'glutes'], BAND, 1, { avoid: ['back'] }, ['Hips back, soft knees.', 'Flat back the whole way.']),
  ex('dumbbell_rdl', 'Romanian deadlift (dumbbell or kettlebell)', 'hinge', ['hamstrings', 'glutes'], LOAD, 2, { regress: 'band_good_morning', progress: 'trap_bar_deadlift' }, ['Slide the weight down the thighs.', 'Stop when the hips stop moving back.']),
  ex('kettlebell_swing', 'Kettlebell swing', 'hinge', ['glutes', 'hamstrings'], [['kettlebell']], 2, { avoid: ['back'], notMain: true }, ['Hike it back, snap the hips.', 'The arms are just ropes.']),
  ex('hip_thrust', 'Hip thrust', 'hinge', ['glutes'], [['bench', 'dumbbells'], ['bench', 'barbell'], ['bench']], 2, { regress: 'glute_bridge' }, ['Shoulders on the bench.', 'Chin tucked, ribs down at the top.']),
  ex('trap_bar_deadlift', 'Trap-bar or barbell deadlift', 'hinge', ['glutes', 'hamstrings', 'quads'], [['barbell']], 3, { regress: 'dumbbell_rdl', avoid: ['back'] }, ['Brace, then push the floor away.', 'Bar stays close.']),
  ex('barbell_rdl', 'Barbell Romanian deadlift', 'hinge', ['hamstrings', 'glutes'], [['barbell']], 3, { regress: 'dumbbell_rdl', avoid: ['back'] }, ['Soft knees, long spine.', 'Feel the hamstrings, not the back.']),
  ex('nordic_hamstring_assisted', 'Assisted Nordic curl', 'hinge', ['hamstrings'], [['bands'], ['bodyweight']], 3, { avoid: ['hamstring', 'knee'], notMain: true }, ['Lower as slowly as you can.', 'Catch yourself, push back up.']),
  ex('hamstring_curl_machine', 'Hamstring curl', 'hinge', ['hamstrings'], [['machines'], ['cable']], 2, { notMain: true }, ['Control the way back.', 'Hips stay down.']),

  // ── Single leg (the running-focused default) ──
  ex('step_up_bw', 'Step-up', 'single_leg', ['quads', 'glutes'], [['box'], ['bench']], 1, { uni: true, progress: 'step_up_loaded' }, ['Whole foot on the box.', 'Push through the top leg, not the bottom one.']),
  ex('step_up_loaded', 'Weighted step-up', 'single_leg', ['quads', 'glutes'], [['box', 'dumbbells'], ['bench', 'dumbbells'], ['box', 'kettlebell']], 2, { uni: true, regress: 'step_up_bw', progress: 'barbell_step_up' }, ['Stand tall at the top.', 'Lower slowly.']),
  ex('barbell_step_up', 'Barbell step-up', 'single_leg', ['quads', 'glutes'], [['barbell', 'rack', 'box']], 3, { uni: true, regress: 'step_up_loaded' }, ['Start with a low box.', 'No push from the trailing leg.']),
  ex('split_squat_bw', 'Split squat', 'single_leg', ['quads', 'glutes'], BW, 1, { uni: true, progress: 'split_squat_loaded' }, ['Long stance, back heel up.', 'Drop straight down.']),
  ex('split_squat_loaded', 'Weighted split squat', 'single_leg', ['quads', 'glutes'], LOAD, 2, { uni: true, regress: 'split_squat_bw', progress: 'bulgarian_split_squat_loaded' }, ['Torso tall.', 'Front knee over the middle of the foot.']),
  ex('bulgarian_split_squat_bw', 'Rear-foot-elevated split squat', 'single_leg', ['quads', 'glutes'], [['bench'], ['box'], ['bodyweight']], 2, { uni: true, regress: 'split_squat_bw', progress: 'bulgarian_split_squat_loaded' }, ['Back foot laces down.', 'Most of the work in the front leg.']),
  ex('bulgarian_split_squat_loaded', 'Weighted rear-foot-elevated split squat', 'single_leg', ['quads', 'glutes'], [['bench', 'dumbbells'], ['bench', 'kettlebell'], ['box', 'dumbbells']], 3, { uni: true, regress: 'bulgarian_split_squat_bw' }, ['Heavy and controlled.', 'Front foot flat the whole rep.']),
  ex('reverse_lunge_bw', 'Reverse lunge', 'single_leg', ['quads', 'glutes'], BW, 1, { uni: true, progress: 'reverse_lunge_loaded' }, ['Step back, drop the knee.', 'Drive up through the front heel.']),
  ex('reverse_lunge_loaded', 'Weighted reverse lunge', 'single_leg', ['quads', 'glutes'], LOAD, 2, { uni: true, regress: 'reverse_lunge_bw' }, ['Step back, drop the back knee.', 'Pause at the bottom.']),
  // STRENGTH-KNEE-DOMINANT-01 — single-leg RDLs are HINGES by movement (hip-dominant). In the
  // single-leg slot they sat beside the hinge slot's RDL and left 28% of leg sessions with no
  // knee-dominant lift. The single-leg slot is now knee-dominant only.
  ex('single_leg_rdl_bw', 'Single-leg Romanian deadlift', 'hinge', ['hamstrings', 'glutes'], BW, 1, { uni: true, progress: 'single_leg_rdl_loaded' }, ['Hips square to the floor.', 'Reach back with the free heel.']),
  ex('single_leg_rdl_loaded', 'Weighted single-leg Romanian deadlift', 'hinge', ['hamstrings', 'glutes'], LOAD, 2, { uni: true, regress: 'single_leg_rdl_bw', progress: 'b_stance_rdl' }, ['Weight in the opposite hand.', 'Slow down, slow up.']),
  ex('b_stance_rdl', 'Kickstand Romanian deadlift', 'hinge', ['hamstrings', 'glutes'], [['dumbbells'], ['kettlebell'], ['barbell']], 3, { uni: true, regress: 'single_leg_rdl_loaded' }, ['Back toe for balance only.', 'Load it heavy.']),
  ex('skater_squat', 'Skater squat', 'single_leg', ['quads', 'glutes'], BW, 3, { uni: true, avoid: ['knee'] }, ['Back knee to the floor.', 'Arms forward to balance.']),
  ex('lateral_lunge', 'Lateral lunge', 'single_leg', ['adductors', 'glutes', 'quads'], [['bodyweight'], ['dumbbells'], ['kettlebell']], 2, { uni: true }, ['Sit into one hip.', 'Other leg long.']),
  ex('single_leg_box_squat', 'Single-leg box squat', 'single_leg', ['quads', 'glutes'], [['box'], ['bench']], 3, { uni: true, avoid: ['knee'] }, ['Sit back to the box on one leg.', 'Knee stays over the toes.']),

  // ── Calf and soleus (tendon capacity) ──
  ex('double_heel_raise', 'Heel raise', 'calf', ['calves'], BW, 1, { progress: 'single_leg_heel_raise' }, ['Full height, slow down.', 'Off a step if you have one.']),
  ex('single_leg_heel_raise', 'Single-leg heel raise', 'calf', ['calves'], BW, 2, { uni: true, regress: 'double_heel_raise', progress: 'weighted_single_leg_heel_raise' }, ['Up in one second, down in three.', 'All the way up, every rep.']),
  ex('weighted_single_leg_heel_raise', 'Weighted single-leg heel raise', 'calf', ['calves'], LOAD, 3, { uni: true, regress: 'single_leg_heel_raise' }, ['Hold the weight on the working side.', 'Same slow tempo.']),
  ex('bent_knee_heel_raise', 'Bent-knee heel raise', 'calf', ['soleus'], BW, 1, { uni: true, progress: 'seated_calf_raise_loaded' }, ['Knee bent and stays bent.', 'This is the soleus, the one running loads most.']),
  ex('seated_calf_raise_loaded', 'Seated calf raise', 'calf', ['soleus'], [['dumbbells', 'bench'], ['kettlebell', 'bench'], ['machines']], 2, { regress: 'bent_knee_heel_raise' }, ['Weight on the knees.', 'Big range, slow lower.']),
  ex('machine_calf_raise', 'Standing calf raise (machine)', 'calf', ['calves'], [['machines']], 3, { regress: 'single_leg_heel_raise' }, ['Heavy and slow.', 'Pause at the bottom stretch.']),

  // ── Hip abduction ──
  ex('side_lying_leg_raise', 'Side-lying leg raise', 'hip_abduction', ['hip_abductors'], BW, 1, { uni: true, progress: 'banded_side_step' }, ['Toes slightly down.', 'Lift from the hip, not the waist.']),
  ex('clamshell', 'Clamshell', 'hip_abduction', ['hip_abductors', 'glutes'], [['bands'], ['bodyweight']], 1, { uni: true }, ['Feet together, knees open.', 'Hips stay stacked.']),
  ex('banded_side_step', 'Banded side step', 'hip_abduction', ['hip_abductors'], BAND, 2, { regress: 'side_lying_leg_raise' }, ['Stay low.', 'Do not let the knees cave.']),
  ex('side_plank_hip_abduction', 'Side plank with leg lift', 'hip_abduction', ['hip_abductors', 'obliques'], BW, 3, { uni: true, regress: 'side_lying_leg_raise', avoid: ['shoulder'] }, ['Straight line head to heel.', 'Lift the top leg, no hips dropping.']),
  ex('cable_hip_abduction', 'Cable hip abduction', 'hip_abduction', ['hip_abductors'], [['cable'], ['machines']], 2, { uni: true }, ['Stand tall.', 'Move from the hip, slowly back.']),
  ex('single_leg_balance_reach', 'Single-leg balance reach', 'hip_abduction', ['hip_abductors', 'glutes'], BW, 1, { uni: true }, ['Knee over the toes.', 'Reach, return, stay tall.']),

  // ── Plyometrics (after strength, never with it) ──
  ex('pogo_hops', 'Pogo hops', 'plyometric', ['calves'], BW, 1, { impact: 'high', measure: 'contacts', progress: 'single_leg_pogo' }, ['Stiff ankles, quick contacts.', 'Bounce off the balls of the feet.']),
  ex('skipping_rope_style', 'Low skips', 'plyometric', ['calves'], BW, 1, { impact: 'high', measure: 'contacts' }, ['Light and rhythmic.', 'Barely leave the ground.']),
  ex('squat_jump', 'Squat jump', 'plyometric', ['quads', 'glutes'], BW, 2, { impact: 'high', measure: 'contacts' }, ['Land quiet and soft.', 'Reset between jumps.']),
  ex('single_leg_pogo', 'Single-leg pogo', 'plyometric', ['calves'], BW, 2, { uni: true, impact: 'high', measure: 'contacts', regress: 'pogo_hops' }, ['Short and springy.', 'Stop when the contacts get loud.']),
  ex('lateral_bound', 'Lateral bound', 'plyometric', ['glutes', 'hip_abductors'], BW, 2, { uni: true, impact: 'high', measure: 'contacts' }, ['Stick each landing.', 'Hips and knee in line.']),
  ex('box_jump', 'Box jump', 'plyometric', ['quads', 'glutes'], [['box']], 2, { impact: 'high', measure: 'contacts' }, ['Step down, never jump down.', 'Low box, good landings.']),
  ex('bounding', 'Bounding', 'plyometric', ['glutes', 'calves'], BW, 3, { impact: 'high', measure: 'contacts' }, ['Exaggerated running stride.', 'Float, then land under the hips.']),
  ex('drop_jump', 'Drop jump', 'plyometric', ['calves', 'quads'], [['box']], 3, { impact: 'high', measure: 'contacts', regress: 'box_jump' }, ['Step off, rebound fast.', 'Ground contact as short as you can.']),

  // ── Upper push ──
  ex('incline_push_up', 'Incline push-up', 'upper_push', ['chest', 'triceps', 'shoulders'], [['bench'], ['box'], ['bodyweight']], 1, { progress: 'push_up' }, ['Hands on a bench or worktop.', 'Body in one line.']),
  ex('push_up', 'Push-up', 'upper_push', ['chest', 'triceps', 'shoulders'], BW, 2, { regress: 'incline_push_up', progress: 'feet_elevated_push_up' }, ['Elbows at about 45 degrees.', 'Chest to the floor.']),
  ex('feet_elevated_push_up', 'Feet-elevated push-up', 'upper_push', ['chest', 'shoulders', 'triceps'], [['bench'], ['box']], 3, { regress: 'push_up', avoid: ['shoulder'] }, ['Hips do not sag.', 'Full range.']),
  ex('band_chest_press', 'Banded chest press', 'upper_push', ['chest', 'triceps'], BAND, 1, {}, ['Band behind the back.', 'Press out, control back.']),
  ex('dumbbell_floor_press', 'Dumbbell floor press', 'upper_push', ['chest', 'triceps'], [['dumbbells']], 2, {}, ['Elbows touch the floor, then press.', 'Wrists stacked.']),
  ex('dumbbell_bench_press', 'Dumbbell bench press', 'upper_push', ['chest', 'triceps', 'shoulders'], [['dumbbells', 'bench']], 2, { avoid: ['shoulder'] }, ['Feet planted.', 'Lower to the sides of the chest.']),
  ex('half_kneeling_press', 'Half-kneeling single-arm press', 'upper_push', ['shoulders', 'triceps', 'core'], LOAD, 2, { uni: true, avoid: ['shoulder'] }, ['Squeeze the down-knee glute.', 'Press up, no leaning back.']),
  ex('barbell_bench_press', 'Barbell bench press', 'upper_push', ['chest', 'triceps', 'shoulders'], [['barbell', 'bench', 'rack']], 3, { avoid: ['shoulder'] }, ['Use a spotter or safeties.', 'Bar to the lower chest.']),

  // ── Upper pull ──
  ex('prone_ytw', 'Prone Y-T-W raise', 'upper_pull', ['back', 'shoulders'], BW, 1, { notMain: true }, ['Face down, thumbs up.', 'Squeeze the shoulder blades.']),
  ex('table_row', 'Table row', 'upper_pull', ['back', 'biceps'], BW, 1, { progress: 'inverted_row' }, ['Under a sturdy table, grip the edge.', 'Pull your chest to it.']),
  ex('band_row', 'Banded row', 'upper_pull', ['back', 'biceps'], BAND, 1, { progress: 'single_arm_dumbbell_row' }, ['Anchor the band at chest height.', 'Elbows back, chest tall.']),
  ex('band_pull_apart', 'Band pull-apart', 'upper_pull', ['back', 'shoulders'], BAND, 1, {}, ['Arms straight.', 'Pull to the chest, slow back.']),
  ex('single_arm_dumbbell_row', 'Single-arm dumbbell row', 'upper_pull', ['back', 'biceps'], [['dumbbells', 'bench'], ['kettlebell', 'bench'], ['dumbbells']], 2, { uni: true, regress: 'band_row' }, ['Flat back.', 'Pull the elbow to the hip.']),
  ex('inverted_row', 'Inverted row', 'upper_pull', ['back', 'biceps'], [['barbell', 'rack']], 2, { regress: 'table_row', progress: 'pull_up', bw: true }, ['Heels down, body straight.', 'Chest to the bar.']),
  ex('lat_pulldown', 'Lat pulldown', 'upper_pull', ['back', 'biceps'], [['cable'], ['machines']], 2, {}, ['Pull to the top of the chest.', 'No swinging.']),
  ex('pull_up', 'Pull-up (assisted if needed)', 'upper_pull', ['back', 'biceps'], [['pullup_bar']], 3, { regress: 'inverted_row', avoid: ['shoulder'] }, ['A band under the feet counts.', 'Chin over the bar, slow down.']),

  // ── Core: anti-rotation ──
  ex('bird_dog', 'Bird dog', 'anti_rotation', ['core', 'glutes'], BW, 1, { uni: true }, ['Opposite arm and leg.', 'Hips stay level, like a tray of drinks.']),
  ex('pallof_press', 'Pallof press', 'anti_rotation', ['core', 'obliques'], [['bands'], ['cable']], 2, { uni: true }, ['Press out and hold.', 'Do not let it turn you.']),
  ex('suitcase_carry', 'Suitcase carry', 'anti_rotation', ['core', 'obliques'], LOAD, 2, { uni: true, measure: 'seconds' }, ['Weight in one hand, walk tall.', 'No leaning.']),
  ex('half_kneeling_cable_chop', 'Half-kneeling chop', 'anti_rotation', ['core', 'obliques'], [['cable'], ['bands']], 3, { uni: true }, ['Hips square.', 'Move the arms, not the trunk.']),
  ex('plank_shoulder_tap', 'Plank shoulder tap', 'anti_rotation', ['core', 'shoulders'], BW, 2, { avoid: ['shoulder'] }, ['Feet wide.', 'Tap without rocking.']),

  // ── Core: anti-extension ──
  ex('dead_bug', 'Dead bug', 'anti_extension', ['core'], BW, 1, { progress: 'weighted_dead_bug' }, ['Lower back pressed down.', 'Breathe out as the limbs go long.']),
  ex('front_plank', 'Front plank', 'anti_extension', ['core'], BW, 1, { measure: 'seconds' }, ['Elbows under shoulders.', 'Squeeze glutes, ribs down.']),
  ex('weighted_dead_bug', 'Weighted dead bug', 'anti_extension', ['core'], LOAD, 2, { regress: 'dead_bug' }, ['Weight held over the chest.', 'Slow and controlled.']),
  ex('kneeling_walkout', 'Kneeling walkout', 'anti_extension', ['core', 'shoulders'], BW, 3, { avoid: ['back', 'shoulder'] }, ['From kneeling, walk the hands out.', 'Only as far as the back stays flat.']),
  ex('hollow_hold', 'Hollow hold', 'anti_extension', ['core'], BW, 2, { measure: 'seconds' }, ['Lower back down.', 'Bend the knees to make it easier.']),

  // ── Core: lateral ──
  ex('side_plank_knees', 'Side plank (knees)', 'lateral_core', ['obliques', 'core'], BW, 1, { uni: true, measure: 'seconds', progress: 'side_plank' }, ['Hips forward and up.', 'Elbow under the shoulder.']),
  ex('side_plank', 'Side plank', 'lateral_core', ['obliques', 'core', 'hip_abductors'], BW, 2, { uni: true, measure: 'seconds', regress: 'side_plank_knees', avoid: ['shoulder'] }, ['Straight line.', 'Push the floor away.']),
  ex('copenhagen_plank_short', 'Short-lever Copenhagen plank', 'lateral_core', ['adductors', 'obliques'], [['bench'], ['box']], 3, { uni: true, measure: 'seconds', regress: 'side_plank' }, ['Knee on the bench, not the foot.', 'Short holds, quality first.']),
  ex('farmer_carry', 'Farmer carry', 'lateral_core', ['core', 'back'], LOAD, 2, { measure: 'seconds' }, ['Heavy, tall, slow.', 'Shoulders down.']),

  // ── Mobility (race week; cooldowns) ──
  ex('hip_flexor_stretch', 'Half-kneeling hip flexor stretch', 'mobility', ['hip_flexors'], BW, 1, { uni: true, measure: 'seconds' }, ['Tuck the pelvis under.', 'Gentle, not forced.']),
  ex('calf_stretch_wall', 'Wall calf stretch', 'mobility', ['calves', 'soleus'], BW, 1, { uni: true, measure: 'seconds' }, ['Straight knee, then bent knee.', 'Heel down.']),
  ex('pigeon_stretch', 'Pigeon stretch', 'mobility', ['glutes'], BW, 1, { uni: true, measure: 'seconds', avoid: ['knee'] }, ['Use a cushion under the hip.', 'Breathe into it.']),
  ex('thoracic_rotation', 'Open book rotation', 'mobility', ['back'], BW, 1, { uni: true }, ['Knees stacked.', 'Follow the hand with your eyes.']),
  ex('hamstring_floss', 'Lying hamstring floss', 'mobility', ['hamstrings'], BW, 1, { uni: true }, ['Leg up, bend and straighten.', 'No bouncing.']),
  ex('ninety_ninety', '90/90 hip switch', 'mobility', ['glutes', 'hip_flexors'], BW, 1, {}, ['Sit tall.', 'Rotate knees side to side, slowly.']),
]

export const CATALOGUE_BY_ID: ReadonlyMap<string, Exercise> = new Map(CATALOGUE.map(e => [e.id, e]))

export const PATTERN_REGION: Record<Pattern, 'lower' | 'upper' | 'core' | 'prep'> = {
  squat: 'lower', hinge: 'lower', single_leg: 'lower', calf: 'lower', hip_abduction: 'lower', plyometric: 'lower',
  upper_push: 'upper', upper_pull: 'upper',
  anti_rotation: 'core', anti_extension: 'core', lateral_core: 'core',
  mobility: 'prep', warmup: 'prep',
}

/** The patterns whose heavy loading makes a session "heavy legs" under §7 (S2). */
export const HEAVY_LEG_PATTERNS: readonly Pattern[] = ['squat', 'hinge', 'single_leg', 'calf', 'plyometric']
