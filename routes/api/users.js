<<<<<<< Updated upstream
const express = require("express");
const router = express.Router();

const ctrl = require("../../controllers/users");
const schemas = require("../../schemas/users");
const { validateBody, authenticate } = require("../../middlewares");

router.get("/favorites", authenticate, ctrl.getAllFavorites);

router.patch(
  "/favorites",
  authenticate,
  validateBody(schemas.updateFavoritesSchema),
  ctrl.updateFavorite
);

module.exports = router;
=======
// router.patch(
//   "/:quizId/favorite",
// authenticate,
//   isValidQuizId,
/* maybe it should be here helpers validateBody?? */
//   ctrl.updateFavorite
// );
>>>>>>> Stashed changes
