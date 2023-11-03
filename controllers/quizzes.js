const Quiz = require('../models/quiz');
const Question = require('../models/question');
const Category = require('../models/category');
const User = require('../models/user');
const { ctrlWrapper, HttpError } = require('../helpers');
const errMsg = require('../constants/errors');

const addQuiz = async (req, res) => {
  const { quizCategory, quizType, quizName, questions } = req.body;

  const quiz = {
    quizCategory,
    quizType,
    quizName,
    rate: 0,
    totalPassed: 0,
    owner: req.user._id,
  };

  const resQuiz = await Quiz.create(quiz);

  questions.forEach(el => (el.quizId = resQuiz._id));

  const resQuestions = await Question.insertMany(questions);

  const newQuiz = {
    _id: resQuiz._id,
    owner: resQuiz.owner,
    quizCategory: resQuiz.quizCategory,
    quizType: resQuiz.quizType,
    quizName: resQuiz.quizName,
    rate: resQuiz.rate,
    totalPassed: resQuiz.totalPassed,
    questions: resQuestions,
  };

  res.status(201).json(newQuiz);
};

const updateQuiz = async (req, res) => {
  const { quizCategory, quizType, quizName, rate, totalPassed, questions } =
    req.body;

  const quiz = {
    quizCategory,
    quizType,
    quizName,
    rate,
    totalPassed,
  };

  const resQuiz = await Quiz.findByIdAndUpdate(req.params.quizId, quiz, {
    new: true,
  });
  if (!resQuiz) {
    throw HttpError(404);
  }

  try {
    await Question.deleteMany({ quizId: req.params.quizId });
    const resAddQuestions = await Question.insertMany(questions);

    const newQuiz = {
      _id: resQuiz._id,
      owner: resQuiz.owner,
      quizCategory: resQuiz.quizCategory,
      quizType: resQuiz.quizType,
      quizName: resQuiz.quizName,
      rate: resQuiz.rate,
      totalPassed: resQuiz.totalPassed,
      questions: resAddQuestions,
    };
    res.json(newQuiz);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update quiz questions!' });
  }

  // // Цей метод не враховує випадок, коли зменшиться кількість запитань у вікторині
  // // Якщо спочатку було 4, а після оновлення стане 2, то в базі не видаляться 2 зайві запитання
  // const listOfPromises = questions.map((el) => {
  //     const id = el._id;
  //     delete el._id;
  //     return Question.findByIdAndUpdate(id, el, { new: true });
  // });

  // try {
  //     const resQuestions = await Promise.all(listOfPromises);
  //     const newQuiz = {
  //         _id: resQuiz._id,
  //         owner: resQuiz.owner,
  //         quizCategory: resQuiz.quizCategory,
  //         quizType: resQuiz.quizType,
  //         quizName: resQuiz.quizName,
  //         rate: resQuiz.rate,
  //         totalPassed: resQuiz.totalPassed,
  //         questions: resQuestions,
  //     };

  //     res.json(newQuiz);
  // } catch (err) {
  //     console.log("err :>> ", err);
  //     res.status(400).json({ message: "Failed to update quiz questions!" });
  // }
};

const deleteQuiz = async (req, res) => {
  const { quizId } = req.params;

  const result = await Quiz.findByIdAndRemove(req.params.quizId);
  if (!result) {
    throw HttpError(404, errMsg.errMsgQuizNotFound);
  }

  await Promise.all([
    Question.deleteMany({ quizId: quizId }), // delete quiz by id
    User.updateMany(
      { 'passedQuizzes.quizId': quizId },
      { $pull: { passedQuizzes: { quizId: quizId } } }
    ), // delete all id quizzes from passed
    User.updateMany({}, { $pull: { favorites: quizId } }), // delete all id quizzes from favorites
  ]);

  // В кого було видалено, перерахувати середній бал

  res.json({ message: 'Quiz deleted!' });
};

// **************************************
const getAllQuizCreateUser = async (req, res) => {
  const { page = 1, limit = 6 } = req.query;

  const skip = (page - 1) * limit;
  const options = { skip, limit };
  const { _id } = req.user;
  const par = { owner: _id };
  const result = await Quiz.find(par, '_id quizName rate totalPassed', options)
    .populate('quizCategory', '-_id categoryName')
    .populate('owner', 'favorites');
  // *************************// чи знаходиться в обраних
  const prepareData = result.map(el => {
    const newEl = JSON.parse(JSON.stringify(el));
    const { _id } = newEl;
    const { favorites } = newEl.owner;
    const isFavorite = favorites.find(favId => favId === _id);

    if (isFavorite) {
      newEl.owner.favorites = true;
    } else {
      newEl.owner.favorites = false;
    }
    return newEl;
  });

  res.json(prepareData);
};
// *****************************
const patchOnePassed = async (req, res) => {
  const quizId = req.params.quizId;
  const result = await Quiz.findOneAndUpdate(
    {
      _id: quizId,
    },
    {
      $inc: { totalPassed: 1 },
    },
    {
      returnDocument: 'after',
    }
  );
  res.json(result);
};
// ****************************************

const getOneQuiz = async (req, res) => {
  const id = req.params.quizId;

  const result = await Question.find(
    { quizId: id },
    'image question answers time'
  ).populate('quizId', 'quizName');
  res.json(result);
};
// *****************************************
const getSearchQuiz = async (req, res) => {
  const { page = 1, limit = 6, q, type, rate, category } = req.query;

  const skip = (page - 1) * limit;
  // *******************************************//
  // let filter = {};
  // if (q) {
  //   filter.quizName = new RegExp(q, 'i');
  // }
  // if (type) {
  //   filter.quizType = type;
  // }
  // if (rate) {
  //   filter.rate = { $gte: rate }; // більше або рівно
  //   // якщо потрібно менше або рівно, то { $$lte: rate }
  // }
  // if (category) {
  //   filter.quizCategory = category;
  // }
  // const result = await Quiz.find(filter, '', { skip, limit });
  // *******************************************//
  const options = { skip, limit };
  const qq = new RegExp(`${q}`, 'i');

  const catId = await Category.find({ categoryName: category }); // видалити 2 строки якщо пошук по id
  const oneCategory = catId.map(itm => itm._id); // ------

  const arrOprions = [
    { quizName: qq },
    { quizType: type },
    { quizCategory: oneCategory },
  ]; // замінити при пошуку по id на category

  if (rate) {
    arrOprions.push({
      rate: { $gte: Number(rate) - 0.5, $lt: Number(rate) + 0.5 },
    });
  }

  const result = await Quiz.find({ $or: arrOprions }, '', options)
    .populate('quizCategory')
    .populate('owner', 'favorites');

  // *************************// чи знаходиться в обраних
  const prepareData = result.map(el => {
    const newEl = JSON.parse(JSON.stringify(el));
    const { _id } = newEl;
    const { favorites } = newEl.owner;
    const isFavorite = favorites.find(favId => favId === _id);

    if (isFavorite) {
      newEl.owner.favorites = true;
    } else {
      newEl.owner.favorites = false;
    }
    return newEl;
  });

  res.json(prepareData);
};

const getRandomQuizzes = async (req, res) => {
  const { limit = 4, audience, sortby } = req.query;

  const getQuizzesByAudience = async audience => {
    const oprionsArr = [{ $match: { quizType: audience } }];

    if (sortby === 'date') {
      oprionsArr.push({ $sort: { createdAt: -1 } });
      oprionsArr.push({ $limit: Number(limit) });
    } else {
      oprionsArr.push({ $sample: { size: Number(limit) } });
    }

    const resObj = await Promise.all([
      Quiz.aggregate(oprionsArr),
      Quiz.find({ quizType: audience }).count(),
    ]);
    return { quizzes: resObj[0], totalCount: resObj[1] };
  };

  const result = {};

  if (audience === undefined) {
    const arrQuizzes = await Promise.all([
      getQuizzesByAudience('adults'),
      getQuizzesByAudience('children'),
    ]);

    result.adults = arrQuizzes[0];
    result.children = arrQuizzes[1];
  } else {
    result[audience] = await getQuizzesByAudience(audience);
  }

  res.json(result);
};

/* to quizzes controllers */
const getPassedQuizzes = async (req, res) => {
  const { _id } = req.user;

  const { passedQuizzes } = await User.findOne(_id);

  const resArray = passedQuizzes.map(item => item.quizId);
  const idArray = resArray.toString().split(',');

  // TODO
  if (passedQuizzes.length === 0) {
    return res.json([]);
  }
  const result = await Quiz.find({ _id: { $in: idArray } })
    .populate('quizCategory', '-_id categoryName')
    .sort('-createdAt');

  const rewers = result.map(item => {
    const matchingObj = passedQuizzes.find(
      quiz => item._id.toString() === quiz.quizId.toString()
    );

    return {
      ...item.toObject(),
      quantityQuestions: matchingObj.quantityQuestions,
      correctAnswers: matchingObj.correctAnswers,
    };
  });

  res.json(rewers);
};

const getTotalAllQuizzes = async (req, res) => {
  const result = await Quiz.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$totalPassed' },
      },
    },
  ]);
  res.json(result[0].total);
};

module.exports = {
  addQuiz: ctrlWrapper(addQuiz),
  getAllQuizCreateUser: ctrlWrapper(getAllQuizCreateUser),
  patchOnePassed: ctrlWrapper(patchOnePassed),
  getOneQuiz: ctrlWrapper(getOneQuiz),
  getSearchQuiz: ctrlWrapper(getSearchQuiz),
  updateQuiz: ctrlWrapper(updateQuiz),
  getRandomQuizzes: ctrlWrapper(getRandomQuizzes),
  deleteQuiz: ctrlWrapper(deleteQuiz),
  getPassedQuizzes: ctrlWrapper(getPassedQuizzes) /* to  */,
  getTotalAllQuizzes: ctrlWrapper(getTotalAllQuizzes),
};
