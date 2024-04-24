const fs = require('fs');

// Read the JSON file
fs.readFile('questions.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading JSON file:', err);
    return;
  }

  try {
    const jsonData = JSON.parse(data);
    const questions = jsonData.questions;

    // Remove duplicate questions
    const uniqueQuestions = [...new Set(questions)];

    console.log("Unique questions:");
    console.log(uniqueQuestions);

    // Write the unique questions back to the JSON file
    const uniqueData = JSON.stringify({ questions: uniqueQuestions }, null, 2);
    fs.writeFile('unique_questions.json', uniqueData, (err) => {
      if (err) {
        console.error('Error writing unique questions to file:', err);
        return;
      }
      console.log('Unique questions written to unique_questions.json');
    });
  } catch (err) {
    console.error('Error parsing JSON:', err);
  }
});
