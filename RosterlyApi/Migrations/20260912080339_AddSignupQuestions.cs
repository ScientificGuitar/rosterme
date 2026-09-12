using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterlyApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSignupQuestions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SignupQuestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Required = table.Column<bool>(type: "boolean", nullable: false),
                    Options = table.Column<string>(type: "character varying(2500)", maxLength: 2500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignupQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignupQuestions_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SignupAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SignupId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignupAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignupAnswers_SignupQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "SignupQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SignupAnswers_Signups_SignupId",
                        column: x => x.SignupId,
                        principalTable: "Signups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SignupAnswers_QuestionId",
                table: "SignupAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_SignupAnswers_SignupId_QuestionId",
                table: "SignupAnswers",
                columns: new[] { "SignupId", "QuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SignupQuestions_EventId",
                table: "SignupQuestions",
                column: "EventId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SignupAnswers");

            migrationBuilder.DropTable(
                name: "SignupQuestions");
        }
    }
}
