/**
 * Backend-ready contracts for the Englishine MVP.
 * These are documentation-only until an API/database layer is selected.
 * TODO(BACKEND): enforce ownership, authentication, authorization and validation server-side.
 * @typedef {Object} ActivationCode
 * @property {string} code
 * @property {'course'|'unit'|'lesson'|'bundle'} unlockType
 * @property {string} targetId
 * @property {number} maxUses
 * @property {number} usedCount
 * @property {string} expiresAt ISO datetime
 * @property {string|null} [assignedStudentId]
 *
 * @typedef {Object} CourseProduct
 * @property {string} id
 * @property {string} stageId
 * @property {string} gradeId
 * @property {string} termId
 * @property {'unit'|'monthly'|'term'|'annual'} bundleType
 * @property {number|null} priceMinorUnits Never trust a client-provided price.
 * @property {number|null} discountMinorUnits
 * @property {'locked'|'preview'|'unlocked'} accessStatus
 *
 * @typedef {Object} HomeworkSubmission
 * @property {string} id
 * @property {string} studentId
 * @property {string} lessonId
 * @property {'not-opened'|'in-progress'|'submitted'} status
 * @property {string|null} textAnswer
 * @property {string|null} uploadObjectKey Store bytes outside the database.
 */
export const backendRequired = true;