using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class RenameOrganizationToGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Events_Organizations_OrganizationId",
                table: "Events");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Organizations",
                table: "Organizations");

            migrationBuilder.RenameTable(
                name: "Organizations",
                newName: "Groups");

            migrationBuilder.RenameColumn(
                name: "ClerkUserId",
                table: "Groups",
                newName: "GroupOwner");

            migrationBuilder.RenameIndex(
                name: "IX_Organizations_ClerkUserId",
                table: "Groups",
                newName: "IX_Groups_GroupOwner");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Groups",
                table: "Groups",
                column: "Id");

            migrationBuilder.RenameColumn(
                name: "OrganizationId",
                table: "Events",
                newName: "GroupId");

            migrationBuilder.RenameIndex(
                name: "IX_Events_OrganizationId_Date",
                table: "Events",
                newName: "IX_Events_GroupId_Date");

            migrationBuilder.AddForeignKey(
                name: "FK_Events_Groups_GroupId",
                table: "Events",
                column: "GroupId",
                principalTable: "Groups",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Events_Groups_GroupId",
                table: "Events");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Groups",
                table: "Groups");

            migrationBuilder.RenameTable(
                name: "Groups",
                newName: "Organizations");

            migrationBuilder.RenameColumn(
                name: "GroupOwner",
                table: "Organizations",
                newName: "ClerkUserId");

            migrationBuilder.RenameIndex(
                name: "IX_Groups_GroupOwner",
                table: "Organizations",
                newName: "IX_Organizations_ClerkUserId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Organizations",
                table: "Organizations",
                column: "Id");

            migrationBuilder.RenameColumn(
                name: "GroupId",
                table: "Events",
                newName: "OrganizationId");

            migrationBuilder.RenameIndex(
                name: "IX_Events_GroupId_Date",
                table: "Events",
                newName: "IX_Events_OrganizationId_Date");

            migrationBuilder.AddForeignKey(
                name: "FK_Events_Organizations_OrganizationId",
                table: "Events",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
