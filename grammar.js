const PREC = {
  COMMA: -1,
  FUNCTION: 1,
  PRIORITY: 2,

  OR: 3, //=> or
  AND: 4, //=> and
  COMPARE: 5, //=> < <= == ~= >= >
  BIT_OR: 6, //=> |
  BIT_NOT: 7, //=> ~
  BIT_AND: 8, //=> &
  SHIFT: 9, //=> << >>
  CONCAT: 10, //=> ..
  PLUS: 11, //=> + -
  MULTI: 12, //=> * / // %
  UNARY: 13, //=> not # - ~
  POWER: 14, //=> ^
};

module.exports = grammar({
  name: 'lua',

  // extras: $ => [$.comment, /[\s\n]/],
  extras: $ => [/[\s\n]/],

  inline: $ => [$._statement, $.line_comment],

  conflicts: $ => [
    [$._prefix],
    [$._expression, $._variable_declarator],
    [$._expression, $.function_call_statement],
    [$.function_name, $.function_name_field],
  ],

  externals: $ => [$.string],

  rules: {
    program: $ =>
      seq(
        repeat($._statement),
        optional(alias($.return_statement, $.module_return_statement)),
      ),

    // Return statement
    return_statement: $ =>
      seq(
        'return',
        optional(sequence($._expression)),
        optional($._empty_statement),
      ),

    // Statements
    _statement: $ =>
      choice(
        alias($._expression, $.expression),

        $.variable_declaration,
        $.local_variable_declaration,

        $.do_statement,
        $.if_statement,
        $.while_statement,
        $.repeat_statement,
        $.for_statement,
        $.for_in_statement,

        $.goto_statement,
        $.break_statement,

        $.label_statement,
        $._empty_statement,

        alias($.function_statement, $.function),
        alias($.local_function_statement, $.local_function),
        alias($.function_call_statement, $.function_call),
        $.comment,
      ),

    // Statements: Variable eclarations
    variable_declaration: $ =>
      seq(
        optional($.lua_documentation),
        sequence(alias($._variable_declarator, $.variable_declarator)),
        '=',
        sequence($._expression),
      ),

    local_variable_declaration: $ =>
      seq(
        'local',
        alias($._local_variable_declarator, $.variable_declarator),
        optional(seq('=', sequence($._expression))),
      ),

    _variable_declarator: $ =>
      choice(
        $.identifier,
        seq($._prefix, '[', $._expression, ']'),
        $.field_expression,
      ),

    field_expression: $ =>
      seq($._prefix, '.', alias($.identifier, $.property_identifier)),

    _local_variable_declarator: $ => sequence($.identifier),

    // Statements: Control statements
    do_statement: $ =>
      seq('do', repeat($._statement), optional($.return_statement), 'end'),

    if_statement: $ =>
      seq(
        'if',
        alias($._expression, $.condition_expression),
        'then',
        repeat($._statement),
        optional($.return_statement),
        repeat($.elseif),
        optional($.else),
        'end',
      ),

    elseif: $ =>
      seq(
        'elseif',
        alias($._expression, $.condition_expression),
        'then',
        repeat($._statement),
        optional($.return_statement),
      ),

    else: $ => seq('else', repeat($._statement), optional($.return_statement)),

    while_statement: $ =>
      seq(
        'while',
        alias($._expression, $.condition_expression),
        'do',
        repeat($._statement),
        optional($.return_statement),
        'end',
      ),

    repeat_statement: $ =>
      seq(
        'repeat',
        repeat($._statement),
        optional($.return_statement),
        'until',
        alias($._expression, $.condition_expression),
      ),

    // Statements: For statements
    for_statement: $ =>
      seq(
        'for',
        alias($._loop_expression, $.loop_expression),
        'do',
        repeat($._statement),
        optional($.return_statement),
        'end',
      ),

    for_in_statement: $ =>
      seq(
        'for',
        alias($._in_loop_expression, $.loop_expression),
        'do',
        repeat($._statement),
        optional($.return_statement),
        'end',
      ),

    _loop_expression: $ =>
      seq(
        $.identifier,
        '=',
        $._expression,
        ',',
        $._expression,
        optional(seq(',', $._expression)),
      ),

    _in_loop_expression: $ =>
      seq(sequence($.identifier), 'in', sequence($._expression)),

    // Statements: Simple statements
    goto_statement: $ => seq('goto', $.identifier),

    break_statement: $ => 'break',

    // Statements: Void statements
    label_statement: $ => seq('::', $.identifier, '::'),

    _empty_statement: $ => ';',

    // Statements: Function statements
    parameter_description: $ => /[^\n]*/,

    parameter_documentation: $ =>
      // seq('--@param ', $.identifier, ':', /[^\n]*\n/),
      // seq('--@param p:', /[^\n]*\n/),
      seq(
        /--@param\s*/,
        field('name', $.identifier),
        /\s*:/,
        field('description', $.parameter_description),
        '\n',
      ),

    return_description: $ => seq(/--@returns[^\n]*\n/),

    line_comment: $ => prec.left(10, choice(seq(/--[^@].*\n/), seq(/---.*\n/))),

    lua_documentation: $ =>
      prec.left(
        PREC.FUNCTION,
        seq(
          /---.*\n/,
          repeat(
            choice(
              prec.left(1, $.parameter_documentation),
              prec.left(1, $.return_description),
              prec.left(2, $.line_comment),
            ),
          ),
        ),
      ),

    function_statement: $ =>
      prec.left(
        PREC.FUNCTION,
        seq(
          // TODO: Add function comments
          optional($.lua_documentation),
          'function',
          $.function_name,
          $._function_body,
        ),
      ),

    local_function_statement: $ =>
      seq(
        optional($.lua_documentation),
        'local',
        'function',
        // TODO: Decide whether this should be function name or what.
        // alias($.identifier, $.function_name),
        $.identifier,
        $._function_body,
      ),

    function_call_statement: $ =>
      prec.dynamic(
        PREC.PRIORITY,
        choice(
          seq($._prefix, $.arguments),
          seq($._prefix, ':', alias($.identifier, $.method), $.arguments),
        ),
      ),

    arguments: $ =>
      choice(
        seq('(', optional(sequence($._expression)), ')'),
        $.table,
        $.string,
      ),

    function_name: $ =>
      seq(
        choice($.identifier, $.function_name_field),
        optional(seq(':', alias($.identifier, $.method))),
      ),

    function_name_field: $ =>
      seq(
        field('object', $.identifier),
        repeat(seq('.', alias($.identifier, $.property_identifier))),
      ),

    parameters: $ =>
      seq(
        '(',
        optional(
          seq(
            choice($.self, $.spread, $.identifier),
            repeat(seq(',', $.identifier)),
            optional(seq(',', $.spread)),
          ),
        ),
        ')',
      ),

    _function_body: $ =>
      seq(
        $.parameters,
        repeat($._statement),
        optional($.return_statement),
        'end',
      ),

    // Expressions
    _expression: $ =>
      choice(
        $.spread,
        $._prefix,

        $.next,

        $.function_definition,

        $.table,

        $.binary_operation,
        $.unary_operation,

        $.string,
        $.number,
        $.nil,
        $.true,
        $.false,
        $.identifier,
      ),

    // Expressions: Common
    spread: $ => '...',

    self: $ => 'self',

    next: $ => 'next',

    global_variable: $ => choice('_G', '_VERSION'),

    _prefix: $ =>
      choice(
        $.self,
        $.global_variable,
        $._variable_declarator,
        prec(-1, alias($.function_call_statement, $.function_call)),
        seq('(', $._expression, ')'),
      ),

    // Expressions: Function definition
    function_definition: $ => seq('function', $._function_body),

    // Expressions: Table expressions
    table: $ => seq('{', optional($._field_sequence), '}'),

    field: $ =>
      choice(
        seq('[', $._expression, ']', '=', $._expression),
        seq($.identifier, '=', $._expression),
        $._expression,
      ),

    _field_sequence: $ =>
      prec(
        PREC.COMMA,
        seq(
          $.field,
          repeat(seq($._field_sep, $.field)),
          optional($._field_sep),
        ),
      ),

    _field_sep: $ => choice(',', ';'),

    // Expressions: Operation expressions
    binary_operation: $ =>
      choice(
        ...[
          ['or', PREC.OR],
          ['and', PREC.AND],
          ['<', PREC.COMPARE],
          ['<=', PREC.COMPARE],
          ['==', PREC.COMPARE],
          ['~=', PREC.COMPARE],
          ['>=', PREC.COMPARE],
          ['>', PREC.COMPARE],
          ['|', PREC.BIT_OR],
          ['~', PREC.BIT_NOT],
          ['&', PREC.BIT_AND],
          ['<<', PREC.SHIFT],
          ['>>', PREC.SHIFT],
          ['+', PREC.PLUS],
          ['-', PREC.PLUS],
          ['*', PREC.MULTI],
          ['/', PREC.MULTI],
          ['//', PREC.MULTI],
          ['%', PREC.MULTI],
        ].map(([operator, precedence]) =>
          prec.left(precedence, seq($._expression, operator, $._expression)),
        ),
        ...[
          ['..', PREC.CONCAT],
          ['^', PREC.POWER],
        ].map(([operator, precedence]) =>
          prec.right(precedence, seq($._expression, operator, $._expression)),
        ),
      ),

    unary_operation: $ =>
      prec.left(PREC.UNARY, seq(choice('not', '#', '-', '~'), $._expression)),

    // Expressions: Primitives
    number: $ => {
      const decimal_digits = /[0-9]+/;
      signed_integer = seq(optional(choice('-', '+')), decimal_digits);
      decimal_exponent_part = seq(choice('e', 'E'), signed_integer);

      decimal_integer_literal = choice(
        '0',
        seq(optional('0'), /[1-9]/, optional(decimal_digits)),
      );

      hex_digits = /[a-fA-F0-9]+/;
      hex_exponent_part = seq(choice('p', 'P'), signed_integer);

      decimal_literal = choice(
        seq(
          decimal_integer_literal,
          '.',
          optional(decimal_digits),
          optional(decimal_exponent_part),
        ),
        seq('.', decimal_digits, optional(decimal_exponent_part)),
        seq(decimal_integer_literal, optional(decimal_exponent_part)),
      );

      hex_literal = seq(
        choice('0x', '0X'),
        hex_digits,
        optional(seq('.', hex_digits)),
        optional(hex_exponent_part),
      );

      return token(choice(decimal_literal, hex_literal));
    },

    nil: $ => 'nil',
    true: $ => 'true',
    false: $ => 'false',

    // Identifier
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    comment: $ =>
      prec.left(
        PREC.PRIORITY,
        token(
          choice(
            seq('--', /.*\r?\n/),
            comment_level_regex(0),
            comment_level_regex(1),
            comment_level_regex(2),
            comment_level_regex(3),
            comment_level_regex(4),
          ),
        ),
      ),
  },
});

function sequence(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

function comment_level_regex(level) {
  // prettier-ignore
  return new RegExp(
    // Starts a comment
    '--' + '\\s*'

    // Opening brackets
    + ''.concat('\\[', '='.repeat(level), '\\[')

    // Match "Non-Endy" type stuff.
    + '([^\\]][^=]|\\r?\\n)*' 

    // Start on ending
    + '\\]+' + ''.concat('='.repeat(level), '\\]'),

    'g',
  );
}
